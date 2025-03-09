/* Migration to create the geeks table */
exports.up = (pgm) => {
  pgm.createTable('geeks', {
    id: 'id',
    client_id: { type: 'text', notNull: false },
    position_x: { type: 'float', notNull: true },
    position_y: { type: 'float', notNull: true },
    position_z: { type: 'float', notNull: true },
    size: { type: 'float', notNull: true },
    color: { type: 'text', notNull: true },
    active: { type: 'boolean', notNull: true, default: true },
    anon: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp' }
  });
  
  // Add index for faster queries on active geeks
  pgm.createIndex('geeks', 'active');
  pgm.createIndex('geeks', 'anon');
  pgm.createIndex('geeks', 'client_id');
};

exports.down = (pgm) => {
  pgm.dropTable('geeks');
}; 