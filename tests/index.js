/* jshint node:true */

'use strict';

var test = require('tape');
var pgViewGrabber = require('../index.js');

/**
 * @todo  Don't lock down to `mrsdba` on development. Ideally, the test uses a
 *        local Postgres database that is created/populated for each test run.
 */
var dbConfig = require('/coins/coins_auth/conn/dbmap.json').dev.mrs;

test('setup', function(t) {
    pgViewGrabber.config({
        database: dbConfig.db,
        host: dbConfig.host,
        password: dbConfig.password,
        port: dbConfig.port,
        user: dbConfig.username,
    });

    t.end();
});

test('get table migration', function(t) {
    t.plan(2);

    pgViewGrabber.getTableMigration({
        name: 'mrs_studies',
    })
        .then(function(results) {
            t.ok(Array.isArray(results), 'table migration results are an array');
            t.ok(results.length > 0, 'table migration has results');
        })
        .catch(t.error);
});

test('get view migration', function(t) {
    t.plan(2);

    pgViewGrabber.getViewMigration({
        name: 'mrs_pi_vw',
    })
        .then(function(results) {
            t.ok(Array.isArray(results), 'view migration results are an array');
            t.ok(results.length > 0, 'view migration has results');
        })
        .catch(t.error);
});
