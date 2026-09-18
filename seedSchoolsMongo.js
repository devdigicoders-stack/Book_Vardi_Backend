import mongoose from "mongoose";
import dotenv from "dotenv";
import School from "./Server/models/School.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/bookvardi_db_final";

const DEFAULT_CLASSES = [
  "Nursery", "LKG", "UKG", "Class 1", "Class 2", "Class 3",
  "Class 4", "Class 5", "Class 6", "Class 7", "Class 8",
  "Class 9", "Class 10", "Class 11", "Class 12"
];

const SCHOOLS_DATA = [
  {
    schoolId: "SCH-001",
    name: "Delhi Public School, R.K. Puram",
    shortName: "Delhi Public School",
    board: "CBSE",
    city: "New Delhi",
    district: "New Delhi",
    subdistrict: "RK Puram",
    address: "Sector 12, R.K. Puram, New Delhi",
    pincode: "110022",
    lat: 28.5684,
    lng: 77.1834,
    classes: DEFAULT_CLASSES,
    studentCount: 4200,
    contactPerson: "Mrs. Sunita Chawla",
    email: "admin@dpsrkp.net",
    phone: "+91 11 2617 1267",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-002",
    name: "The Mother’s International School",
    shortName: "The Mother’s International School",
    board: "CBSE",
    city: "New Delhi",
    district: "New Delhi",
    subdistrict: "Vijay Mandal",
    address: "Sri Aurobindo Marg, Vijay Mandal Enclave, New Delhi",
    pincode: "110016",
    lat: 28.5398,
    lng: 77.1994,
    classes: DEFAULT_CLASSES.slice(3),
    studentCount: 2600,
    contactPerson: "Dr. Arvind Menon",
    email: "principal@mis.org.in",
    phone: "+91 11 2652 4810",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-003",
    name: "St. Xavier Senior Secondary School",
    shortName: "St. Xavier Senior Secondary",
    board: "ICSE",
    city: "Gurugram",
    district: "Gurugram",
    subdistrict: "Sector 14",
    address: "Sector 49, Rosewood City, Gurugram, Haryana",
    pincode: "122018",
    lat: 28.4195,
    lng: 77.0566,
    classes: DEFAULT_CLASSES.slice(1),
    studentCount: 3100,
    contactPerson: "Fr. Matthew D’Souza",
    email: "contact@stxaviersgurugram.in",
    phone: "+91 124 405 9182",
    status: "Partner Active",
    exclusiveKit: false
  },
  {
    schoolId: "SCH-004",
    name: "Kendriya Vidyalaya No. 1",
    shortName: "Kendriya Vidyalaya",
    board: "CBSE",
    city: "Pune",
    district: "Pune",
    subdistrict: "Ganeshkhind",
    address: "Ganeshkhind Road, Armament Colony, Pune, Maharashtra",
    pincode: "411007",
    lat: 18.5402,
    lng: 73.8340,
    classes: DEFAULT_CLASSES.slice(3),
    studentCount: 1850,
    contactPerson: "Mr. Satish Waghmare",
    email: "kv1pune@kvsedu.gov.in",
    phone: "+91 20 2634 1190",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-005",
    name: "Modern School, Barakhamba Road",
    shortName: "Modern School, Barakhamba",
    board: "CBSE",
    city: "New Delhi",
    district: "New Delhi",
    subdistrict: "Central Delhi",
    address: "Barakhamba Road, Connaught Place, New Delhi",
    pincode: "110001",
    lat: 28.6304,
    lng: 77.2285,
    classes: DEFAULT_CLASSES.slice(6),
    studentCount: 2900,
    contactPerson: "Col. Rajesh Verma",
    email: "admin@modernschool.net",
    phone: "+91 11 2331 1618",
    status: "Partner Active",
    exclusiveKit: false
  },
  {
    schoolId: "SCH-006",
    name: "Ryan International School",
    shortName: "Ryan International",
    board: "CBSE",
    city: "New Delhi",
    district: "New Delhi",
    subdistrict: "Mayur Vihar",
    address: "Mayur Vihar Phase 3, Delhi NCR",
    pincode: "110096",
    lat: 28.6094,
    lng: 77.2982,
    classes: DEFAULT_CLASSES,
    studentCount: 3400,
    contactPerson: "Mrs. Kavita Saxena",
    email: "info@ryanmayurvihar.edu",
    phone: "+91 11 2261 4455",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-007",
    name: "CMS Gomti Nagar Campus",
    shortName: "City Montessori School",
    board: "ICSE",
    city: "Lucknow",
    district: "Lucknow",
    subdistrict: "Kamta",
    address: "Kamta Bypass, Gomti Nagar Phase 2, Lucknow, Uttar Pradesh",
    pincode: "226010",
    lat: 26.8790,
    lng: 81.0118,
    classes: DEFAULT_CLASSES,
    studentCount: 3800,
    contactPerson: "Dr. Sunita Gandhi",
    email: "gomtinagar@cmseducation.org",
    phone: "+91 522 272 8810",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-008",
    name: "La Martiniere College",
    shortName: "La Martiniere",
    board: "ICSE",
    city: "Lucknow",
    district: "Lucknow",
    subdistrict: "Kamta",
    address: "La Martiniere Road, Hazratganj, Lucknow, Uttar Pradesh",
    pincode: "226001",
    lat: 26.8467,
    lng: 80.9462,
    classes: DEFAULT_CLASSES.slice(3),
    studentCount: 2900,
    contactPerson: "Mr. Carlyle McFarland",
    email: "principal@lamartiniere.org",
    phone: "+91 522 223 5421",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-009",
    name: "DPS Kanpur Kalyanpur",
    shortName: "DPS Kanpur",
    board: "CBSE",
    city: "Kanpur",
    district: "Kanpur",
    subdistrict: "Jajmau",
    address: "GT Road, Jajmau Industrial Zone, Kanpur, Uttar Pradesh",
    pincode: "208010",
    lat: 26.4312,
    lng: 80.4026,
    classes: DEFAULT_CLASSES,
    studentCount: 3100,
    contactPerson: "Mrs. Archana Nigam",
    email: "info@dpskanpur.edu.in",
    phone: "+91 512 258 0910",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-010",
    name: "Children's College Azamgarh",
    shortName: "Children's College",
    board: "CBSE",
    city: "Azamgarh",
    district: "Azamgarh",
    subdistrict: "RTO Area",
    address: "RTO Road, Civil Lines, Azamgarh, Uttar Pradesh",
    pincode: "276001",
    lat: 26.0682,
    lng: 83.1844,
    classes: DEFAULT_CLASSES,
    studentCount: 2200,
    contactPerson: "Mr. S. K. Rastogi",
    email: "ccazamgarh@gmail.com",
    phone: "+91 5462 220 311",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-011",
    name: "St. Clare's Senior Secondary School",
    shortName: "St. Clare's School",
    board: "CBSE",
    city: "Lucknow",
    district: "Lucknow",
    subdistrict: "Kamta",
    address: "Faizabad Road, Kamta Crossing, Lucknow, Uttar Pradesh",
    pincode: "226028",
    lat: 26.8820,
    lng: 81.0150,
    classes: DEFAULT_CLASSES,
    studentCount: 2400,
    contactPerson: "Sr. Mary Joseph",
    email: "stclareslk@gmail.com",
    phone: "+91 522 270 0112",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-012",
    name: "Army Public School Nehru Road",
    shortName: "Army Public School",
    board: "CBSE",
    city: "Lucknow",
    district: "Lucknow",
    subdistrict: "Kamta",
    address: "Cantonment, Nehru Road, Lucknow, Uttar Pradesh",
    pincode: "226002",
    lat: 26.8320,
    lng: 80.9510,
    classes: DEFAULT_CLASSES.slice(3),
    studentCount: 3500,
    contactPerson: "Col. P. K. Sharma",
    email: "apslucknow@awes.edu.in",
    phone: "+91 522 248 1145",
    status: "Partner Active",
    exclusiveKit: false
  }
];

async function updateSchoolsInMongoDB() {
  try {
    console.log("Connecting to MongoDB at:", mongoUri);
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully!");

    // Update or upsert schools
    for (const data of SCHOOLS_DATA) {
      await School.findOneAndUpdate(
        { $or: [{ schoolId: data.schoolId }, { name: data.name }] },
        { $set: data },
        { upsert: true, new: true }
      );
      console.log(`✅ Upserted School in MongoDB: ${data.name} (Classes count: ${data.classes.length})`);
    }

    // Convert any remaining string classes in MongoDB to arrays
    const allSchools = await School.find();
    let convertedCount = 0;
    for (const sch of allSchools) {
      if (!Array.isArray(sch.classes) || typeof sch.classes === "string") {
        sch.classes = DEFAULT_CLASSES;
        await sch.save();
        convertedCount++;
      }
    }

    console.log(`🎉 Complete! Processed ${allSchools.length} schools in MongoDB. Converted ${convertedCount} legacy records.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding/updating MongoDB schools:", error);
    process.exit(1);
  }
}

updateSchoolsInMongoDB();
