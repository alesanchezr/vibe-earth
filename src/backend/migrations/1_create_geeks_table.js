/* Migration to create the geeks table */
exports.up = (pgm) => {
  pgm.createTable('geeks', {
    id: 'id',
    position_x: { type: 'float', notNull: true },
    position_y: { type: 'float', notNull: true },
    position_z: { type: 'float', notNull: true },
    size: { type: 'float', notNull: true },
    color: { type: 'text', notNull: true },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp' }
  });
  
  // Add index for faster queries on active geeks
  pgm.createIndex('geeks', 'active');
};

exports.down = (pgm) => {
  pgm.dropTable('geeks');
}; 