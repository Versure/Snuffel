/// <reference path="../pb_data/types.d.ts" />

// Turns PocketBase's default `users` auth collection into Snuffel's accounts:
// login with `username` + password, a required `name` and a `role` (child | parent),
// optional e-mail, no avatar, and access rules where a child only sees and edits itself
// (only `name` and, with the old password, `password`) and a parent reads and manages all.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_');

    users.fields.removeByName('avatar');

    const email = users.fields.getByName('email');
    email.required = false;

    const name = users.fields.getByName('name');
    name.required = true;
    name.min = 1;
    name.max = 40;

    users.fields.add(
      new TextField({
        name: 'username',
        required: true,
        presentable: true,
        min: 3,
        max: 20,
        pattern: '^[a-z0-9][a-z0-9-]{2,19}$',
      }),
    );
    users.fields.add(
      new SelectField({
        name: 'role',
        required: true,
        maxSelect: 1,
        values: ['child', 'parent'],
      }),
    );
    users.indexes = [
      ...users.indexes,
      'CREATE UNIQUE INDEX idx_users_username ON users (username COLLATE NOCASE)',
    ];

    users.passwordAuth.enabled = true;
    users.passwordAuth.identityFields = ['username'];
    users.oauth2.enabled = false;
    users.oauth2.mappedFields.avatarURL = '';
    users.otp.enabled = false;
    users.mfa.enabled = false;

    users.listRule = 'id = @request.auth.id || @request.auth.role = "parent"';
    users.viewRule = 'id = @request.auth.id || @request.auth.role = "parent"';
    users.createRule = '@request.auth.role = "parent"';
    users.updateRule =
      '(id = @request.auth.id && @request.body.role:isset = false && @request.body.username:isset = false && @request.body.email:isset = false && @request.body.verified:isset = false) || @request.auth.role = "parent"';
    users.deleteRule = '@request.auth.role = "parent"';
    users.manageRule = null;

    app.save(users);
  },
  (app) => {
    // Back to PocketBase's default `users` collection.
    const users = app.findCollectionByNameOrId('_pb_users_auth_');

    users.listRule = 'id = @request.auth.id';
    users.viewRule = 'id = @request.auth.id';
    users.createRule = '';
    users.updateRule = 'id = @request.auth.id';
    users.deleteRule = 'id = @request.auth.id';
    users.manageRule = null;

    users.passwordAuth.identityFields = ['email'];
    users.indexes = users.indexes.filter((index) => !index.includes('idx_users_username'));

    users.fields.removeByName('username');
    users.fields.removeByName('role');

    const name = users.fields.getByName('name');
    name.required = false;
    name.min = 0;
    name.max = 255;

    const email = users.fields.getByName('email');
    email.required = true;

    users.fields.add(
      new FileField({
        name: 'avatar',
        maxSelect: 1,
        maxSize: 0,
        mimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp'],
      }),
    );
    users.oauth2.mappedFields.avatarURL = 'avatar';

    app.save(users);
  },
);
