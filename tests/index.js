/* jshint node:true */

'use strict';

var test = require('tape');
var pgViewGrabber = require('../index.js');

/**
 * @todo  Don't lock down to `mrsdba` on development. Ideally, the test uses a
 *        local Postgres database that is created/populated for each test run.
 */
var dbConfig = require('/coins/config/dbmap.json');

test('setup', function(t) {
    pgViewGrabber.config({
        database: dbConfig._default.db,
        host: dbConfig.development._default.host,
        password: dbConfig._apps.mrs.password,
        port: dbConfig._default.port,
        user: dbConfig._apps.mrs.username,
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
