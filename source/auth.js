/**
 * Auth wrapper
 * @type {*|exports|module.exports}
 */
var express = require('express');
var user = require('./models/user.js');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcrypt');


/**
 * provide basic verify function with callback of err/decoded returned
 * @param token
 * @param callback
 */
var verify = function (token, callback) {
	jwt.verify(token, 'secret', function (err, decoded) {
		callback(err, decoded);
	})
}

/**
 * ensureAuth is a middleware which filter the json token for verifying login
 * @param req
 * @param res
 * @param next
 *
 * usage:
 * in router.js ---router.use('*some url*', auth.ensureAuth, *next middleware function*)
 * in next middleware ---var middleware = function(req, res, next){var authResult = req.body.auth}
 */
var ensureAuth = function (req, res, next) {
	//Get token from body or query or headers
	var token = req.body.token || req.query.token || req.headers['token'] || req.cookies.token;
	if (token) {
		return jwt.verify(token, 'secret', function (err, decoded) {
			if (err) {
				req.body.auth = {
					success: false,
					message: 'Invalid'
				};
				return next();
			} else {
				req.body.auth = {
					success: true,
					decoded: decoded
				};
				return next();
			}
		});
	} else {
		req.body.auth = {
			success: false,
			message: 'Null'
		};
		return next();
	}

	// have not yet implemented else!!!!
};

/**
 * provide api function for authorization (currently not usable)
 * @param req
 * @param res
 * @returns {res.json(response)}
 */
var api = function (req, res) {
	if (req.body.auth.success) {
		var response = {
			success: true,
			message: 'Login Successful!'
		};
		return res.json(response);
	} else {
		var response = {
			success: false,
			message: 'Login Failed!'
		};
		return res.json(response);
	}
};

/**
 * auth is a middleware provide function for login use and set authorization info
 * @param req
 * @param res
 * @param next
 * usage:
 * use like ensureAuth before login controller
 */
var setAuth = function (id, name) {
	var tmpuser = {};
	tmpuser.id = id;
	tmpuser.name = name

	//set token
	var token = jwt.sign(tmpuser, 'secret', {
		expiresIn: '30d'
	});
	return token;
};

/**
 * bcrypt compare password
 * @param user
 * @param password
 */
var isValidPassword = function (user, password) {
	return bcrypt.compareSync(password, user.password);
};

module.exports.verify = verify;
module.exports.ensureAuth = ensureAuth;
module.exports.setAuth = setAuth;
module.exports.api = api;
