/// <reference path="../pb_data/types.d.ts" />

// `checklist_states`: one record per child, lesson and checklist (practice step) with the ids of
// the ticked items. A child reads and writes only its own records and can only change `checked`;
// the parent reads everything and can delete (reset), but never writes for a child.
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
      name: 'checklist_states',
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
        idField('checklist_id'),
        // A list of item ids, in the order of the items.
        { type: 'json', name: 'checked', required: false, maxSize: 2000 },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_checklist_states_user_checklist ON checklist_states (user, lesson_id, checklist_id)',
      ],
      listRule: 'user = @request.auth.id || @request.auth.role = "parent"',
      viewRule: 'user = @request.auth.id || @request.auth.role = "parent"',
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule:
        'user = @request.auth.id && @request.body.user:isset = false && @request.body.lesson_id:isset = false && @request.body.checklist_id:isset = false',
      deleteRule: '@request.auth.role = "parent"',
    });

    app.save(collection);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('checklist_states'));
  },
);
