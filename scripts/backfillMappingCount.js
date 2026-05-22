require('dotenv').config();
const sequelize = require('../config/database');
const MappedStudent = require('../models/Mappedstudents');
const StudentCourse = require('../models/StudentCourse');
const { QueryInterface, DataTypes } = require('sequelize');

async function run() {
  const queryInterface = sequelize.getQueryInterface();

  // 1️⃣ Add the column if it doesn't exist yet
  try {
    await queryInterface.addColumn('student_courses', 'mappingCount', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Total number of times this student has been mapped to a company'
    });
    console.log('✅ Column mappingCount added to student_courses');
  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('Duplicate column')) {
      console.log('ℹ️  Column mappingCount already exists, skipping add.');
    } else {
      throw err;
    }
  }

  // 2️⃣ Count existing mappings per student from MappedStudents table
  const mappings = await MappedStudent.findAll({
    attributes: [
      'studentId',
      [sequelize.fn('COUNT', sequelize.col('studentId')), 'count']
    ],
    group: ['studentId'],
    raw: true
  });

  console.log(`📊 Found ${mappings.length} students with existing mappings`);

  // 3️⃣ Update each student's mappingCount
  let updated = 0;
  for (const row of mappings) {
    const affected = await StudentCourse.update(
      { mappingCount: parseInt(row.count, 10) },
      { where: { studentId: row.studentId } }
    );
    if (affected[0] > 0) updated++;
  }

  console.log(`✅ Backfilled mappingCount for ${updated} students`);

  // 4️⃣ Set 0 for students with no mappings (already defaulted, just confirm)
  console.log('✅ Students with no mappings already default to 0');

  await sequelize.close();
  console.log('🎉 Done!');
}

run().catch(err => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});