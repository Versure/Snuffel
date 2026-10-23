/// <reference path="../pb_data/types.d.ts" />

// `interaction_results`: every finished game (an interaction such as `trace-game`) is a new
// record (append-only), with score, total, a small json detail and the version of the lesson.
// A child adds and reads only its own results; nobody updates a result; the parent reads
// everything and can delete, but never writes for a child. A score above total is refused.
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
      name: 'interaction_results',
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
        idField('interaction_id'),
        // Plain text instead of a select: a new kind of interaction needs no migration.
        idField('kind'),
        // Not required: for PocketBase "required" on a number means "not 0", and 0 is a score.
        { type: 'number', name: 'score', required: false, onlyInt: true, min: 0 },
        { type: 'number', name: 'total', required: true, onlyInt: true, min: 1 },
        { type: 'json', name: 'detail', required: false, maxSize: 4096 },
        { type: 'number', name: 'content_version', required: true, onlyInt: true, min: 1 },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_interaction_results_user_lesson ON interaction_results (user, lesson_id)',
      ],
      listRule: 'user = @request.auth.id || @request.auth.role = "parent"',
      viewRule: 'user = @request.auth.id || @request.auth.role = "parent"',
      createRule:
        '@request.auth.id != "" && @request.body.user = @request.auth.id && @request.body.score <= @request.body.total',
      updateRule: null,
      deleteRule: '@request.auth.role = "parent"',
    });

    app.save(collection);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('interaction_results'));
  },
);
