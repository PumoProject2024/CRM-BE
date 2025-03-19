const { CourseDetails } = require('../models/CourseDetails');

async function seedCourseData() {
  try {
    // First, check if data already exists
    const existingCount = await CourseDetails.count();
    if (existingCount > 0) {
      console.log('Course data already seeded. Skipping...');
      return;
    }

    // Course seed data based on the hard-coded data in frontend
    const courseData = [
      // IT Basic courses
      { courseType: "IT Basic", courseName: "JAVA Developer", courseDuration: "6 months" },
      { courseType: "IT Basic", courseName: "Python Developer", courseDuration: "6 months" },
      { courseType: "IT Basic", courseName: "DOTNET Developer", courseDuration: "6 months" },
      { courseType: "IT Basic", courseName: "UI/UX Engineer", courseDuration: "4 months" },
      { courseType: "IT Basic", courseName: "Software Testing", courseDuration: "3 months" },
      { courseType: "IT Basic", courseName: "Web Design and Development", courseDuration: "5 months" },
      { courseType: "IT Basic", courseName: "Android Development", courseDuration: "6 months" },
      { courseType: "IT Basic", courseName: "AWS/AZURE Development", courseDuration: "4 months" },
      { courseType: "IT Basic", courseName: "DevOps Engineer", courseDuration: "6 months" },
      { courseType: "IT Basic", courseName: "Robotic Process Automation Engineer", courseDuration: "4 months" },
      
      // IT Advanced courses
      { courseType: "IT Advanced", courseName: "Data Science", courseDuration: "9 months" },
      { courseType: "IT Advanced", courseName: "Data Analysis", courseDuration: "6 months" },
      { courseType: "IT Advanced", courseName: "Business Analysis", courseDuration: "6 months" },
      
      // Mech Basic courses
      { courseType: "Mech Basic", courseName: "Product Design", courseDuration: "6 months" },
      { courseType: "Mech Basic", courseName: "Industrial Design", courseDuration: "6 months" },
      { courseType: "Mech Basic", courseName: "Automotive Design", courseDuration: "6 months" },
      { courseType: "Mech Basic", courseName: "CAE Engineer", courseDuration: "6 months" },
      { courseType: "Mech Basic", courseName: "Wiring Harness Design", courseDuration: "4 months" },
      { courseType: "Mech Basic", courseName: "CAM Programmer", courseDuration: "5 months" },
      { courseType: "Mech Basic", courseName: "HVAC Engineer", courseDuration: "4 months" },
      { courseType: "Mech Basic", courseName: "Piping Engineer", courseDuration: "6 months" },
      
      // Mech Advanced courses
      { courseType: "Mech Advanced", courseName: "Industrial Design", courseDuration: "6 months" },
      { courseType: "Mech Advanced", courseName: "Automotive Design", courseDuration: "6 months" },
      { courseType: "Mech Advanced", courseName: "CAE Engineer", courseDuration: "6 months" },
      { courseType: "Mech Advanced", courseName: "CAD/CAM Programming", courseDuration: "6 months" },
      { courseType: "Mech Advanced", courseName: "MEP", courseDuration: "6 months" },
      { courseType: "Mech Advanced", courseName: "Piping Engineer", courseDuration: "6 months" },
      
      // Automation Basic courses
      { courseType: "Automation Basic", courseName: "Automation Engineer", courseDuration: "6 months" },
      { courseType: "Automation Basic", courseName: "ECAD Design Engineer", courseDuration: "5 months" },
      { courseType: "Automation Basic", courseName: "Robotics Engineer", courseDuration: "8 months" },
      { courseType: "Automation Basic", courseName: "BMS Engineer", courseDuration: "6 months" },
      { courseType: "Automation Basic", courseName: "Embedded Engineer", courseDuration: "9 months" },
      { courseType: "Automation Basic", courseName: "PCB Design Engineer", courseDuration: "7 months" },
      { courseType: "Automation Basic", courseName: "VLSI Design Engineer", courseDuration: "8 months" },
      
      // Automation Advanced courses
      { courseType: "Automation Advance", courseName: "Automation", courseDuration: "6 months" },
      { courseType: "Automation Advance", courseName: "Embeddedd", courseDuration: "8 months" },
      
      // Others category
      { courseType: "Others", courseName: "Custom Course", courseDuration: "Variable" }
    ];

    // Bulk insert course data
    await CourseDetails.bulkCreate(courseData);
    console.log('Course data seeded successfully!');
  } catch (error) {
    console.error('Error seeding course data:', error);
  }
}

module.exports = seedCourseData;