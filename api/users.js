const express = require("express");
const usersRouter = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_SECRET_ADMIN } = process.env;
const { createUser, getUser, updateUser, getUserByEmail, getUserById, getResetUserById, deleteResetUser, getAdminById, getInactiveUserById, updateShippingAddress, updateBillingAddress } = require('../db');
const { checkAuthorization } = require("./utils");

// POST /api/users/register
// Registers a user
usersRouter.post('/register', async (req, res, next) => {
    const {
        firstName,
        lastName,
        password,
        phone,
        email,
        shippingAddress,
        billingAddress
    } = req.body;
  
    try {
      const _user = await getUserByEmail(email);
  
      if (_user) {
        res.status(403);
        next({
            error: '403',
            name: 'EmailInUseError',
            message: `${email} is already registered.`
        });
      }
  
      if (password.length < 8) {
        res.status(400);
        next({
            error: '400',
            name: 'PasswordTooShortError',
            message: 'Password too short!'
        })
      }

      const user = await createUser({
        firstName,
        lastName,
        password,
        phone,
        email,
        shippingAddress,
        billingAddress
      });
  
      const token = jwt.sign({ 
        id: user.id, 
        email
      }, process.env.JWT_SECRET, {
        expiresIn: '1w'
      });
  
      res.send({ 
        message: "you're signed up!",
        token,
        user 
      });
    } catch ({ error, name, message }) {
      next({ error, name, message });
    } 
  });

// POST /api/users/login
// Logs in a user
usersRouter.post('/login', async (req, res, next) => {
    const { email, password } = req.body;

    try {
        const user = await getUser({ email, password });
        
        if (!user) {
            res.status(400);
            next({
                error: '400',
                name: 'IncorrectCredentialsError',
                message: 'Incorrect email or password'
            });
        }
        
        const resetUser = await getResetUserById(user.id);
        const inactiveUser = await getInactiveUserById(user.id);

        if (inactiveUser) {
            res.send({
                message: "Your account has been deactivated",
                userId: user.id,
                status: "inactive"
            });
        }

        if (resetUser) {
            res.send({
                message: "Please reset your password",
                userId: user.id,
                needsReset: true
            });
        }


        const token = jwt.sign({ id: user.id, email }, JWT_SECRET);
        const admin = await getAdminById(user.id);

        if(admin) {
            const adminToken = jwt.sign({ id: user.id, email }, JWT_SECRET_ADMIN);
            res.send({
                message: "you're logged in!",
                token,
                adminToken,
                user
            });
        } else {
            res.send({ 
            message: "you're logged in!",
            token,
            user 
            });
        }
        
    } catch ({ error, name, message }) {
      next({ error, name, message });
    } 
});

// DELETE /api/users/password_reset/:userId
// Removes user from the reset_users table and updates their password
usersRouter.delete('/password_reset/:userId', async (req, res, next) => {
    try {
        const { password } = req.body;
        const { userId } = req.params;

        const user = await deleteResetUser(userId, password);

        if (!user) {
            res.status(400);
            next({
                error: '400',
                name: 'SamePasswordError',
                message: 'New password must be different'
            });
        } else {
            const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
            const admin = await getAdminById(user.id);

            if(admin) {
                const adminToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET_ADMIN);
                res.send({
                    message: "you're logged in!",
                    token,
                    adminToken,
                    user
                });
            } else {
                res.send({ 
                message: "you're logged in!",
                token,
                user 
                });
            }
        }
    } catch ({ error, name, message }) {
        next({ error, name, message });
    } 
})

// GET /api/users/me
// Gets a logged in user's info
usersRouter.get('/me', checkAuthorization, async (req, res, next) => {
    try {
        res.send(req.user);
    } catch ({ error, name, message }) {
        next({ error, name, message });
    } 
})

// PATCH /api/users/me
// Edits a logged in user's info
usersRouter.patch('/me', checkAuthorization, async (req, res, next) => {
    try {
        const { id: userId } = req.user;
        const userInfo = { ...req.body };

        delete userInfo.shippingAddress;
        delete userInfo.billingAddress;

        const user = await getUserById(userId);

        if (!user) {
            res.status(404);
            next({
                error: '404',
                name: 'UserNotFoundError',
                message: 'User not found'
            })
        } else if (req.body.email) {
            const userByEmail = await getUserByEmail(req.body.email);

            if (userByEmail && userByEmail.id !== userId) {
                res.status(400);
                next({
                    error: '400',
                    name: 'EmailInUseError',
                    message: 'That email is already in use'
                })
            } else {
                if (req.body.shippingAddress) {
                    await updateShippingAddress(userId, req.body.shippingAddress);
                }
                if (req.body.billingAddress) {
                    await updateBillingAddress(userId, req.body.billingAddress);
                }
                const updatedUser = await updateUser({ id: userId, ...userInfo });
    
                if (!updatedUser) {
                    next({
                        error: '400',
                        name: 'UserUpdateError',
                        message: 'Unable to update user info'
                    })
                } else {
                    res.send(updatedUser);
                }
            }
        } else {
            if (req.body.shippingAddress) {
                await updateShippingAddress(userId, req.body.shippingAddress);
            }
            if (req.body.billingAddress) {
                await updateBillingAddress(userId, req.body.billingAddress);
            }
            const updatedUser = await updateUser({ id: userId, ...userInfo });

            if (!updatedUser) {
                res.status(400);
                next({
                    error: '400',
                    name: 'UserUpdateError',
                    message: 'Unable to update user info'
                })
            } else {
                res.send(updatedUser);
            }
        }
    } catch ({ error, name, message }) {
        next({ error, name, message });
    } 
})

module.exports = usersRouter;