const { Sequelize } = require('sequelize');

console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_USER:", process.env.DB_USER);

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,

    // Explicit (this is also Sequelize's default): DATETIME values are read/written as UTC.
    timezone: '+00:00',

    dialectOptions: {
      charset: 'utf8mb4'
    },

    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    },

    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Must be installed before any model is defined (models require this file).
require('./mariadbCompat')(sequelize);

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('MariaDB connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

testConnection();

module.exports = sequelize;