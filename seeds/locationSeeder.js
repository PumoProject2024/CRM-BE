const { LocationBranch } = require('../models/LocationBranch');

async function seedLocationData() {
  try {
    // First, check if data already exists
    const existingCount = await LocationBranch.count();
    if (existingCount > 0) {
      console.log('Location data already seeded. Skipping...');
      return;
    }

    // Location seed data based on the hard-coded data in frontend
    const locationData = [
      // Chennai branches
      { location: "Chennai", branch: "Velachery" },
      { location: "Chennai", branch: "Vadapalani" },
      { location: "Chennai", branch: "Tambaram" },
      { location: "Chennai", branch: "Poonamallee" },
      
      // Bangalore branches
      { location: "Bangalore", branch: "Marathahalli" },
      
      // Coimbatore branches
      { location: "Coimbatore", branch: "Gandhipuram" },
      { location: "Coimbatore", branch: "Malumichampatti" },
      { location: "Coimbatore", branch: "Saravanampatti" },

      
      // Hosur branches
      { location: "Hosur", branch: "Hamumanthapuram" }
    ];

    // Bulk insert location data
    await LocationBranch.bulkCreate(locationData);
    console.log('Location data seeded successfully!');
  } catch (error) {
    console.error('Error seeding location data:', error);
  }
}

module.exports = seedLocationData;