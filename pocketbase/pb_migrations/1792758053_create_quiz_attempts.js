/// <reference path="../pb_data/types.d.ts" />

// `quiz_attempts`: every answer to a quiz question is a new record (append-only), with the chosen
// option, whether it was right, how many hints were shown and the version of the lesson. A child
// adds and reads only its own attempts; nobody updates an attempt; the parent reads everything
// and can delete, but never writes for a child.
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
      name: 'quiz_attempts',
      fields: [
        {
          type: 'relation',
          name: 'user',
          collectionId: users.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        idField('lesson_id'),
        idField('question_id'),
        idField('option_id'),
        // Not required: for PocketBase "required" on a bool means "must be true".
        { type: 'bool', name: 'correct', required: false },
        { type: 'number', name: 'hints_used', required: false, onlyInt: true, min: 0 },
        { type: 'number', name: 'content_version', required: true, onlyInt: true, min: 1 },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_quiz_attempts_user_lesson ON quiz_attempts (user, lesson_id)'],
      listRule: 'user = @request.auth.id || @request.auth.role = "parent"',
      viewRule: 'user = @request.auth.id || @request.auth.role = "parent"',
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule: null,
      deleteRule: '@request.auth.role = "parent"',
    });

    app.save(collection);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('quiz_attempts'));
  },
);
