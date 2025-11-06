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
      // Certified courses
      { courseType: "Certified", courseName: "Python Developer", courseFees: 40000.00 },
      { courseType: "Certified", courseName: "Machine Learning", courseFees: 65000.00 },
      { courseType: "Certified", courseName: "Data Science Engineer", courseFees: 85000.00 },
      { courseType: "Certified", courseName: "Blockchain Technology", courseFees: 60000.00 },
      { courseType: "Certified", courseName: "Java Developer", courseFees: 50000.00 },
      { courseType: "Certified", courseName: "Software Testing", courseFees: 40000.00 },
      { courseType: "Certified", courseName: "Web Design & Development", courseFees: 45000.00 },
      { courseType: "Certified", courseName: "Android App Development", courseFees: 50000.00 },
      { courseType: "Certified", courseName: ".Net Developer", courseFees: 40000.00 },
      { courseType: "Certified", courseName: "CLOUD Computing (AWS)", courseFees: 40000.00 },
      { courseType: "Certified", courseName: "UI/UX Engineer", courseFees: 50000.00 },
      { courseType: "Certified", courseName: "Devops Engineer", courseFees: 50000.00 },
      { courseType: "Certified", courseName: "ROBOTIC Process Automation", courseFees: 85000.00 },
      { courseType: "Certified", courseName: "Digital Marketing", courseFees: 80000.00 },
      { courseType: "Certified", courseName: "Simulation Analysis", courseFees: 60000.00 },
      { courseType: "Certified", courseName: "Automation Engineer", courseFees: 50000.00 },
      { courseType: "Certified", courseName: "Electrical CAD Engineer", courseFees: 25000.00 },
      { courseType: "Certified", courseName: "Robotics Engineer", courseFees: 60000.00 },
      { courseType: "Certified", courseName: "Industrial IOT Engineer", courseFees: 45000.00 },
      { courseType: "Certified", courseName: "BMS Engineer", courseFees: 45000.00 },
      { courseType: "Certified", courseName: "PCB Design Engineer", courseFees: 35000.00 },
      { courseType: "Certified", courseName: "VLSI Design Engineer", courseFees: 50000.00 },
      { courseType: "Certified", courseName: "HVAC Engineer", courseFees: 30000.00 },
      { courseType: "Certified", courseName: "Business Analyst", courseFees: 70000.00 },
      { courseType: "Certified", courseName: "AR/VR Engineer", courseFees: 75000.00 },
      { courseType: "Certified", courseName: "Structural Design & Analysis", courseFees: 60000.00 },
      { courseType: "Certified", courseName: "Building Design", courseFees: 50000.00 },
      { courseType: "Certified", courseName: "Interior Design", courseFees: 50000.00 },
      { courseType: "Certified", courseName: "SAP MM-Material Management", courseFees: 65000.00 },
      { courseType: "Certified", courseName: "SAP SD-Sales & Distribution", courseFees: 65000.00 },
      { courseType: "Certified", courseName: "SAP FICO Module - Financial Accounting And Controlling", courseFees: 75000.00 },
      { courseType: "Certified", courseName: "SAP ABAP Programming - Advance Business Application Programming", courseFees: 75000.00 },
      { courseType: "Certified", courseName: "Desktop Publishing (DTP)", courseFees: 40000.00 },
      { courseType: "Certified", courseName: "Graphic Design", courseFees: 25000.00 },
      { courseType: "Certified", courseName: "Master Design", courseFees: 100000.00 },
      { courseType: "Certified", courseName: "3D - Animaster", courseFees: 150000.00 },
      { courseType: "Certified", courseName: "UX/UI Developer", courseFees: 50000.00 },
      { courseType: "Certified", courseName: "Game Design & Development", courseFees: 175000.00 },
      { courseType: "Certified", courseName: "Digital Editing", courseFees: 75000.00 },
      { courseType: "Certified", courseName: "Visual Magic (VFX)", courseFees: 100000.00 },
      { courseType: "Certified", courseName: "Architectural Design", courseFees: 75000.00 },
      { courseType: "Certified", courseName: "Jewelary CAD", courseFees: 50000.00 },
      { courseType: "Certified", courseName: "Product Design", courseFees: 35000.00 },
      { courseType: "Certified", courseName: "CAM Programmer", courseFees: 25000.00 },
      { courseType: "Certified", courseName: "Industrial Design", courseFees: 65000.00 },
      { courseType: "Certified", courseName: "CAE", courseFees: 100000.00 },
      { courseType: "Certified", courseName: "Wiring Harness Design", courseFees: 60000.00 },
      { courseType: "Certified", courseName: "CAM Engineer", courseFees: 20000.00 },
      { courseType: "Certified", courseName: "SP3D Engineer", courseFees: 45000.00 },
      { courseType: "Certified", courseName: "Plumbing Engineer", courseFees: 25000.00 },
      { courseType: "Certified", courseName: "E3D Engineer", courseFees: 40000.00 },
      { courseType: "Certified", courseName: "PDMS Engineer", courseFees: 45000.00 },

      // Master courses
      { courseType: "Master", courseName: "Graphic Design", courseFees: 50000.00 },
      { courseType: "Master", courseName: "Multimedia", courseFees: 50000.00 },
      { courseType: "Master", courseName: "Virtual World AR & VR", courseFees: 150000.00 },
      { courseType: "Master", courseName: "VR-Interior Design", courseFees: 125000.00 },
      { courseType: "Master", courseName: "VR-Architectural Design", courseFees: 100000.00 },

      // Diploma courses
      { courseType: "Diploma", courseName: "Industrial Automation", courseFees: 60000.00 },
      { courseType: "Diploma", courseName: "Embedded Automation", courseFees: 50000.00 },
      { courseType: "Diploma", courseName: "Internet Of Things IOT", courseFees: 65000.00 },
      { courseType: "Diploma", courseName: "Automotive Embedded" , courseFees: 80000.00 },
      { courseType: "Diploma", courseName: "E-Vehicle Engineering", courseFees: 125000.00 },
      { courseType: "Diploma", courseName: "Non Destructive Testing (NDT)", courseFees: 50000.00 },
      { courseType: "Diploma", courseName: "MEP Design & Drafting", courseFees: 50000.00 },
      { courseType: "Diploma", courseName: "Architectural Design", courseFees: 75000.00 },
      { courseType: "Diploma", courseName: "R&D Design", courseFees: 100000.00 },
 

      // PG Diploma courses
      { courseType: "PG Diploma", courseName: "Hybrid Vehicle Design & Analysis", courseFees: 130000.00  },


      // PG Program courses
      { courseType: "PG Program", courseName: "BIM Engineer", courseFees: 80000.00 },
      { courseType: "PG Program", courseName: "Automotive Design", courseFees: 90000.00 },
      { courseType: "PG Program", courseName: "CAE", courseFees: 150000.00 },

        ];

    // Bulk insert course data
    await CourseDetails.bulkCreate(courseData);
    console.log('Course data refreshed successfully!');

  } catch (error) {
    console.error('Error seeding course data:', error);
  }
}

module.exports = seedCourseData;