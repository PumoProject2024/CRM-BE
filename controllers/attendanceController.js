const Attendance = require('../models/Attendance');
const { Op } = require('sequelize');

// Create Attendance (updated)
exports.createAttendance = async (req, res) => {
  try {
    const { studentId, InTime, OutTime } = req.body;  // Changed from student_id to studentId

    // Get logged-in user's info (set in auth middleware)
    const { emp_id, emp_name } = req.user || {};

    if (!emp_id || !emp_name) {
      return res.status(401).json({ error: "Unauthorized: Missing user data" });
    }

    console.log("Logged-in User: ", { emp_id, emp_name });

    // Validate required fields
    if (!studentId || !InTime || !OutTime) {  // Changed from student_id to studentId
      return res.status(400).json({
        error: "studentId, InTime, and OutTime are required"  // Changed from student_id to studentId
      });
    }

    // Use current date from backend
    const currentDate = new Date();
    const day = currentDate.getDate();        // 1–31
    const month = currentDate.getMonth() + 1; // 0-based index, so +1
    const year = currentDate.getFullYear();   // 4-digit year

    // Dynamic field to update: day_1 to day_31
    const dayField = `day_${day}`;

    // Prepare the attendance data for that day
    const attendanceData = {
      EmpID: emp_id,
      InTime,
      OutTime
    };

    // Check if attendance record exists for the student, month, and year
    let attendance = await Attendance.findOne({
      where: { studentId, month, year }  // Changed from student_id to studentId
    });

    if (attendance) {
      // Check if today's attendance already exists
      if (attendance[dayField]) {
        return res.status(409).json({
          error: `Attendance already marked for day ${day}`
        });
      }

      // Update existing attendance record
      attendance[dayField] = attendanceData;
      attendance.modified_by = emp_id;
      await attendance.save();

      return res.status(200).json({
        message: "Attendance updated successfully",
        attendance: {
          id: attendance.id,
          studentId,  // Changed from student_id to studentId
          month,
          year,
          day,
          attendance_data: attendanceData
        }
      });
    } else {
      // Create new attendance record
      const newAttendanceData = {
        studentId,  // Changed from student_id to studentId
        month,
        year,
        created_by: emp_id,
        modified_by: emp_id,
        [dayField]: attendanceData // dynamic day field
      };

      attendance = await Attendance.create(newAttendanceData);

      return res.status(201).json({
        message: "Attendance created successfully",
        attendance: {
          id: attendance.id,
          studentId,  // Changed from student_id to studentId
          month,
          year,
          day,
          attendance_data: attendanceData
        }
      });
    }
  } catch (error) {
    console.error("Error in createAttendance:", error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: "Attendance record already exists for this student, month, and year"
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message
    });
  }
};

// Get All Attendance Records (updated)
exports.getAllAttendance = async (req, res) => {
  try {
    const { page = 1, limit = 10, month, year, studentId } = req.query;  // Changed from student_id to studentId
    const offset = (page - 1) * limit;

    // Build where clause based on query parameters
    const whereClause = {};
    
    if (month) {
      whereClause.month = month;
    }
    
    if (year) {
      whereClause.year = year;
    }
    
    if (studentId) {  // Changed from student_id to studentId
      whereClause.studentId = studentId;
    }

    // Get attendance records with pagination
    const { count, rows: attendanceRecords } = await Attendance.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Transform data to include attendance details for each day
    const transformedRecords = attendanceRecords.map(record => {
      const attendanceData = {};
      
      // Extract day-wise attendance data
      for (let day = 1; day <= 31; day++) {
        const dayField = `day_${day}`;
        if (record[dayField]) {
          attendanceData[dayField] = record[dayField];
        }
      }

      return {
        id: record.id,
        studentId: record.studentId,  // Changed from student_id to studentId
        month: record.month,
        year: record.year,
        created_by: record.created_by,
        modified_by: record.modified_by,
        attendance_data: attendanceData,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      };
    });

    return res.status(200).json({
      message: "Attendance records retrieved successfully",
      data: transformedRecords,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalRecords: count,
        recordsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Error in getAllAttendance:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message
    });
  }
};

// Get Attendance by Student ID (updated)
exports.getAttendanceByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;  // Changed from student_id to studentId
    const { 
      month, 
      year, 
      fromDate, 
      toDate, 
      page = 1, 
      limit = 10 
    } = req.query;

    // Validate studentId
    if (!studentId) {  // Changed from student_id to studentId
      return res.status(400).json({
        error: "studentId is required"  // Changed from student_id to studentId
      });
    }

    // Build where clause
    const whereClause = { studentId };  // Changed from student_id to studentId
    
    // Handle date range search
    if (fromDate && toDate) {
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      
      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: "Invalid date format. Please use YYYY-MM-DD format."
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          error: "From date cannot be greater than to date."
        });
      }

      // Create date range conditions
      const startMonth = startDate.getMonth() + 1;
      const startYear = startDate.getFullYear();
      const endMonth = endDate.getMonth() + 1;
      const endYear = endDate.getFullYear();

      // If searching within the same year
      if (startYear === endYear) {
        whereClause.year = startYear;
        if (startMonth === endMonth) {
          whereClause.month = startMonth;
        } else {
          whereClause.month = {
            [Op.between]: [startMonth, endMonth]
          };
        }
      } else {
        // If searching across multiple years
        whereClause[Op.or] = [];
        
        // Add start year condition
        whereClause[Op.or].push({
          year: startYear,
          month: {
            [Op.gte]: startMonth
          }
        });

        // Add end year condition
        whereClause[Op.or].push({
          year: endYear,
          month: {
            [Op.lte]: endMonth
          }
        });

        // Add any full years in between
        if (endYear - startYear > 1) {
          whereClause[Op.or].push({
            year: {
              [Op.between]: [startYear + 1, endYear - 1]
            }
          });
        }
      }
    } else {
      // Original month/year filtering
      if (month) {
        whereClause.month = month;
      }
      
      if (year) {
        whereClause.year = year;
      }
    }

    // Calculate pagination
    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const offset = (pageNumber - 1) * pageSize;

    // Validate pagination parameters
    if (pageNumber < 1) {
      return res.status(400).json({
        error: "Page number must be greater than 0"
      });
    }

    if (pageSize < 1 || pageSize > 100) {
      return res.status(400).json({
        error: "Limit must be between 1 and 100"
      });
    }

    // Get total count for pagination
    const totalCount = await Attendance.count({
      where: whereClause
    });

    // Get attendance records for the student with pagination
    const attendanceRecords = await Attendance.findAll({
      where: whereClause,
      order: [['year', 'DESC'], ['month', 'DESC']],
      limit: pageSize,
      offset: offset
    });

   if (!attendanceRecords || attendanceRecords.length === 0) {
  return res.status(200).json({
    message: "No attendance records found for this student",
    studentId,
    data: [],
    pagination: {
      currentPage: pageNumber,
      totalPages: 0,
      totalRecords: 0,
      recordsPerPage: pageSize,
      hasNextPage: false,
      hasPreviousPage: false,
      startRecord: 0,
      endRecord: 0
    },
    filters: {
      month: month || null,
      year: year || null,
      fromDate: fromDate || null,
      toDate: toDate || null
    }
  });
}


    // Transform data to include attendance details for each day
    const transformedRecords = attendanceRecords.map(record => {
      const attendanceData = {};
      
      // Extract day-wise attendance data and filter by date range if specified
      for (let day = 1; day <= 31; day++) {
        const dayField = `day_${day}`;
        if (record[dayField]) {
          // If date range is specified, filter days within the range
          if (fromDate && toDate) {
            const currentDate = new Date(record.year, record.month - 1, day);
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            
            if (currentDate >= startDate && currentDate <= endDate) {
              attendanceData[dayField] = record[dayField];
            }
          } else {
            attendanceData[dayField] = record[dayField];
          }
        }
      }

      return {
        id: record.id,
        studentId: record.studentId,  // Changed from student_id to studentId
        month: record.month,
        year: record.year,
        created_by: record.created_by,
        modified_by: record.modified_by,
        attendance_data: attendanceData,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = pageNumber < totalPages;
    const hasPreviousPage = pageNumber > 1;

    return res.status(200).json({
      message: "Attendance records retrieved successfully",
      studentId,  // Changed from student_id to studentId
      data: transformedRecords,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalRecords: totalCount,
        recordsPerPage: pageSize,
        hasNextPage,
        hasPreviousPage,
        startRecord: offset + 1,
        endRecord: Math.min(offset + pageSize, totalCount)
      },
      filters: {
        month: month || null,
        year: year || null,
        fromDate: fromDate || null,
        toDate: toDate || null
      }
    });
  } catch (error) {
    console.error("Error in getAttendanceByStudentId:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message
    });
  }
};

// Update Attendance (updated)
exports.updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, InTime, OutTime, day, month, year } = req.body;  // Changed from student_id to studentId

    // Get logged-in user's info (set in auth middleware)
    const { emp_id, emp_name } = req.user || {};

    if (!emp_id || !emp_name) {
      return res.status(401).json({ error: "Unauthorized: Missing user data" });
    }

    // Validate required fields
    if (!id) {
      return res.status(400).json({
        error: "Attendance ID is required"
      });
    }

    // Find the attendance record
    const attendance = await Attendance.findByPk(id);
    
    if (!attendance) {
      return res.status(404).json({
        error: "Attendance record not found"
      });
    }

    // If updating specific day attendance
    if (day && InTime && OutTime) {
      const dayField = `day_${day}`;
      
      // Prepare the attendance data for that day
      const attendanceData = {
        EmpID: emp_id,
        InTime,
        OutTime
      };

      // Update the specific day's attendance
      attendance[dayField] = attendanceData;
      attendance.modified_by = emp_id;
      await attendance.save();

      return res.status(200).json({
        message: "Attendance updated successfully",
        attendance: {
          id: attendance.id,
          studentId: attendance.studentId,  // Changed from student_id to studentId
          month: attendance.month,
          year: attendance.year,
          day,
          attendance_data: attendanceData
        }
      });
    }

    // If updating general attendance record fields
    const updateData = {};
    
    if (studentId) updateData.studentId = studentId;  // Changed from student_id to studentId
    if (month) updateData.month = month;
    if (year) updateData.year = year;
    updateData.modified_by = emp_id;

    // Update the attendance record
    await attendance.update(updateData);

    return res.status(200).json({
      message: "Attendance record updated successfully",
      attendance: {
        id: attendance.id,
        studentId: attendance.studentId,  // Changed from student_id to studentId
        month: attendance.month,
        year: attendance.year,
        modified_by: attendance.modified_by
      }
    });
  } catch (error) {
    console.error("Error in updateAttendance:", error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: "Attendance record already exists for this student, month, and year"
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message
    });
  }
};

// Delete Attendance (no changes needed here)
exports.deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    // Get logged-in user's info (set in auth middleware)
    const { emp_id } = req.user || {};

    if (!emp_id) {
      return res.status(401).json({ error: "Unauthorized: Missing user data" });
    }

    // Find the attendance record
    const attendance = await Attendance.findByPk(id);
    
    if (!attendance) {
      return res.status(404).json({
        error: "Attendance record not found"
      });
    }

    // Delete the attendance record
    await attendance.destroy();

    return res.status(200).json({
      message: "Attendance record deleted successfully",
      deleted_id: id
    });
  } catch (error) {
    console.error("Error in deleteAttendance:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message
    });
  }
};

// Delete a specific day's attendance from a record (no changes needed here)
exports.deleteAttendanceDay = async (req, res) => {
  try {
    const { id, day } = req.params;
    const { emp_id } = req.user || {};

    if (!emp_id) {
      return res.status(401).json({ error: "Unauthorized: Missing user data" });
    }

    const attendance = await Attendance.findByPk(id);

    if (!attendance) {
      return res.status(404).json({ error: "Attendance record not found" });
    }

    const dayField = `day_${day}`;

    if (!attendance[dayField]) {
      return res.status(400).json({ error: `No attendance found for day ${day}` });
    }

    // Delete the specific day's attendance data
    attendance[dayField] = null;
    attendance.modified_by = emp_id;

    await attendance.save();

    return res.status(200).json({
      message: `Attendance for day ${day} deleted successfully`,
      cleared_day: day,
      attendance_id: attendance.id
    });

  } catch (error) {
    console.error("Error in deleteAttendanceDay:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message
    });
  }
};