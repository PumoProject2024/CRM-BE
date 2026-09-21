const seedCourseData = require('./courseSeeder');
const seedLocationData = require('./locationSeeder');
const sequelize = require('../config/database');

async function runSeeders() {
  try {
    // The schema must already exist (created explicitly); only verify connectivity here.
    await sequelize.authenticate();

    // Run seeders
    await seedCourseData();
    await seedLocationData();
    
    console.log('All data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running seeders:', error);
    process.exit(1);
  }
}

// Run seeders
runSeeders();