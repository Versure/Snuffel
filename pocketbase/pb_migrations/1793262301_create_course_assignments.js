/// <reference path="../pb_data/types.d.ts" />

// `course_assignments`: one record per child and course with `access: selected-children` that
// the child may see. Only the parent assigns, and only to a child; a child reads only its own
// assignments (so not which courses a brother or sister sees). Nobody updates: an assignment is
// there or not. The parent removes it to hide the course again (progress stays).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_');

    const collection = new Collection({
      type: 'base',
      name: 'course_assignments',
      fields: [
        {
          type: 'relation',
          name: 'user',
          collectionId: users.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          type: 'text',
          name: 'course_id',
          required: true,
          min: 1,
          max: 60,
          pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
        },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_course_assignments_user_course ON course_assignments (user, course_id)',
      ],
      listRule: 'user = @request.auth.id || @request.auth.role = "parent"',
      viewRule: 'user = @request.auth.id || @request.auth.role = "parent"',
      createRule: '@request.auth.role = "parent" && @request.body.user.role = "child"',
      updateRule: null,
      deleteRule: '@request.auth.role = "parent"',
    });

    app.save(collection);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('course_assignments'));
  },
);
