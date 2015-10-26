# PG View Grabber

_Grab view information from a Postgres database._

## Use

You’ll need to pass in Postgres connection info that will be passed to
[pg](https://www.npmjs.com/package/pg). Use either a connection string (Ex:
`postgres://username:password@localhost/database` or an object:

```js
var myConfig = {
    "database": "postgres",
    "hostname": "localhost",
    "password": "root",
    "port": 5432,
    "username": "root"
}
```

Then, pass it in like so:

```js
var pgViewGrabber = require('pg-view-grabber');

pgViewGrabber(myConfig, 'my_table_name');
```

