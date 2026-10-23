/// <reference path="../pb_data/types.d.ts" />

// `lesson_progress`: one record per child, lesson and step with the status of that step
// (started | completed) and the version of the lesson it was done with. A child reads and
// writes only its own records and can only change `status` and `content_version`; the parent
// reads everything and can delete (reset), but never writes for a child.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_');
    const idPattern = '^[a-z0-9]+(-[a-z0-9]+)*$';
    const idField = (name) => ({
      type: 'text',
      name,
      required: true,
      min: 1,
      max: 60,
      pattern: idPattern,
    });

    const collection = new Collection({
      type: 'base',
      name: 'lesson_progress',
      fields: [
        {
          type: 'relation',
          name: 'user',
          collectionId: users.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        idField('course_id'),
        idField('lesson_id'),
        idField('step_id'),
        {
          type: 'select',
          name: 'status',
          required: true,
          maxSelect: 1,
          values: ['started', 'completed'],
        },
        { type: 'number', name: 'content_version', required: true, onlyInt: true, min: 1 },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_lesson_progress_user_step ON lesson_progress (user, lesson_id, step_id)',
      ],
      listRule: 'user = @request.auth.id || @request.auth.role = "parent"',
      viewRule: 'user = @request.auth.id || @request.auth.role = "parent"',
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule:
        'user = @request.auth.id && @request.body.user:isset = false && @request.body.course_id:isset = false && @request.body.lesson_id:isset = false && @request.body.step_id:isset = false',
      deleteRule: '@request.auth.role = "parent"',
    });

    app.save(collection);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('lesson_progress'));
  },
);
