const seedCourseData = require('./courseSeeder');
const seedLocationData = require('./locationSeeder');
const sequelize = require('../config/database');

async function runSeeders() {
  try {
    // Sync database
    await sequelize.sync();
    
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