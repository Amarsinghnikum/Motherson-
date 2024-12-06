const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect("mongodb://isaqaadmin:password@44.240.110.54:27017/isa_qa", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Device Event Schema
const deviceEventSchema = new mongoose.Schema(
  {
    device_id: { type: String, required: true },
    entity_name: { type: String, required: true },
    module_id: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    dynamicFields: [
      {
        key: { type: String },
        value: { type: String },
      },
    ],
  },
  { collection: "device_events" }
);

const DeviceEvent = mongoose.model("DeviceEvent", deviceEventSchema);

// Motherson Schema for saving data
const mothersonSchema = new mongoose.Schema(
  {
    siteName: { type: String, required: true },
    Devices: [
      {
        device_id: { type: String, required: true },
        module_id: { type: String, required: true },
        dynamic_fields: [
          {
            key: { type: String, required: true },
            value: { type: String, required: false }, // Make 'value' optional
            activeValue: { type: String, default: "" }, // Active value can be empty if not provided
          },
        ],
      },
    ],
  },
  { collection: "device_motherson" }
);


const DeviceMotherson = mongoose.model("DeviceMotherson", mothersonSchema);

// Routes
// Fetch device events
app.get("/device_motherson/:siteName/:device_id", async (req, res) => {
  try {
    const { siteName, device_id } = req.params;

    // Fetch the site and device by siteName and device_id
    const site = await DeviceMotherson.findOne({ siteName });

    if (!site) {
      return res.status(404).json({ message: "Site not found" });
    }

    const device = site.Devices.find(d => d.device_id === device_id);

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    // Return the device details
    return res.status(200).json({ message: "Device found", data: device });
  } catch (error) {
    console.error("Error fetching device:", error);
    res.status(500).json({ message: "Error fetching device", error: error.message });
  }
});

// Get the latest dynamic field keys
app.get("/get-latest-values", async (req, res) => {
  try {
    const { device_id, deviceName, module_id } = req.query;

    if (!device_id || !deviceName || !module_id) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const latestData = await DeviceEvent.find({
      device_id,
      entity_name: deviceName,
      module_id: parseInt(module_id),
    })
      .sort({ createdAt: -1 })
      .limit(20);

    if (latestData.length === 0) {
      return res.status(404).json({ error: "No matching data found" });
    }

    const dynamicFieldsKeys = new Set();
    latestData.forEach((data) => {
      Object.keys(data._doc).forEach((key) => {
        if (key.startsWith("2,") || key.startsWith("3,")) {
          dynamicFieldsKeys.add(key);
        }
      });
    });

    res.status(200).json({ dynamicFieldsKeys: Array.from(dynamicFieldsKeys) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save motherson data
app.post("/device_motherson", async (req, res) => {
  try {
    const { siteName, Devices } = req.body;

    // Ensure siteName is provided
    if (!siteName || siteName.trim() === "") {
      return res.status(400).json({ message: "siteName is required" });
    }

    // Ensure Devices array exists and contains devices with dynamic_fields
    if (!Devices || !Array.isArray(Devices)) {
      return res.status(400).json({ message: "Devices array is required" });
    }

    // Check if the site already exists
    let existingSite = await DeviceMotherson.findOne({ siteName });

    if (!existingSite) {
      // If the site doesn't exist, create a new document with the Devices
      const newSite = new DeviceMotherson({
        siteName,
        Devices: Devices.map(device => ({
          ...device,
          dynamic_fields: device.dynamic_fields || [], // Ensure dynamic_fields is saved
        })),
      });

      await newSite.save();
      return res.status(201).json({ message: "Data saved successfully", data: newSite });
    } else {
      // If the site exists, update the Devices and their dynamic_fields
      Devices.forEach((device) => {
        const existingDevice = existingSite.Devices.find(d => d.device_id === device.device_id);
        if (existingDevice) {
          // Update the dynamic_fields if needed
          existingDevice.dynamic_fields = device.dynamic_fields || [];
        } else {
          // If the device doesn't exist, add it
          existingSite.Devices.push({
            ...device,
            dynamic_fields: device.dynamic_fields || [],
          });
        }
      });

      await existingSite.save();
      return res.status(200).json({ message: "Devices updated successfully", data: existingSite });
    }
  } catch (error) {
    console.error("Error saving data:", error);
    res.status(500).json({ message: "Error saving data", error: error.message });
  }
});

// app.post("/get-device-events", async (req, res) => {
//   try {
//     const { deviceId, module_ids } = req.body;

//     if (!deviceId || !module_ids || !Array.isArray(module_ids)) {
//       return res.status(400).json({
//         error: "Invalid input. `deviceId` and `module_ids` (array) are required.",
//       });
//     }

//     // Match the type of `module_id` in the database
//     const isModuleIdNumeric = typeof (await DeviceEvent.findOne())?.module_id === "number";
//     const formattedModuleIds = isModuleIdNumeric
//       ? module_ids.map((id) => Number(id)) // Convert to numbers if needed
//       : module_ids.map((id) => id.toString()); // Convert to strings if needed

//     const query = {
//       device_id: deviceId,
//       module_id: { $in: formattedModuleIds },
//     };

//     console.log("Executing query:", query);

//     // Fetch the latest record for each module_id using aggregation
//     const matchingData = await DeviceEvent.aggregate([
//       {
//         $match: query,
//       },
//       {
//         $sort: { createdAt: -1 }, // Sort by createdAt in descending order to get the latest
//       },
//       {
//         $group: {
//           _id: "$module_id", // Group by module_id
//           latestEvent: { $first: "$$ROOT" }, // Get the first (latest) event for each module_id
//         },
//       },
//       {
//         $replaceRoot: { newRoot: "$latestEvent" }, // Replace the root with the latest event
//       },
//     ]);

//     if (matchingData.length === 0) {
//       console.warn("No matching data found for the provided module_ids.");
//       return res.status(404).json({ error: "No matching data found." });
//     }

//     console.log(`Found ${matchingData.length} records.`);

//     // Ensure all module_ids are included in the result
//     const includedModuleIds = matchingData.map((data) => data.module_id);
//     console.log("Included module_ids:", includedModuleIds);

//     res.status(200).json(matchingData);
//   } catch (error) {
//     console.error("Error fetching device events:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// app.post("/get-device-events", async (req, res) => {
//   try {
//     const { siteName } = req.body;

//     // Validate input
//     if (!siteName) {
//       return res.status(400).json({ message: "Missing required parameter: siteName" });
//     }

//     // Fetch the site by siteName from the device_motherson table
//     const existingSite = await DeviceMotherson.findOne({ siteName });
//     if (!existingSite) {
//       return res.status(404).json({ message: `Site with name ${siteName} not found` });
//     }

//     // Assuming Devices is an array in the fetched site record
//     const devicesData = existingSite.Devices.map(device => ({
//       device_id: device.device_id,
//       dynamic_fields: device.dynamic_fields,
//     }));

//     // Check if any data exists
//     if (!devicesData || devicesData.length === 0) {
//       return res.status(404).json({ message: "No devices found for this site" });
//     }

//     // Return the fetched devices data
//     res.status(200).json({
//       message: "Devices fetched successfully",
//       data: devicesData,
//     });
//   } catch (error) {
//     console.error("Error fetching data:", error);
//     res.status(500).json({ message: "Error fetching data", error: error.message });
//   }
// });

app.post("/get-device-events", async (req, res) => {
  try {
    const { siteName } = req.body;

    // Validate input
    if (!siteName) {
      return res.status(400).json({ message: "Missing required parameter: siteName" });
    }

    // Fetch the site by siteName from the device_motherson table
    const existingSite = await DeviceMotherson.findOne({ siteName });

    if (!existingSite) {
      return res.status(404).json({ message: `Site with name ${siteName} not found` });
    }

    // Transform the Devices array to include only device_id and module_id
    const devicesPayload = existingSite.Devices.map(device => ({
      device_id: device.device_id,
      module_id: device.module_id,
    }));

    // Check if any devices were found
    if (devicesPayload.length === 0) {
      return res.status(404).json({ message: "No devices found for this site" });
    }

    // Fetch the latest data from device_events table based on device_id and module_id
    const deviceEventPromises = devicesPayload.map(async (device) => {
      try {
        // Fetch the latest event for the given device_id and module_id
        const latestEvent = await DeviceEvent.findOne({
          device_id: device.device_id,
          module_id: device.module_id,
        })
          .sort({ createdAt: -1 }) // Sort by createdAt descending
          .exec(); // Execute the query
          
        return {
          device_id: device.device_id,
          module_id: device.module_id,
          latest_event: latestEvent || null, // Return null if no event is found
        };
      } catch (err) {
        console.error(`Error fetching event for device_id ${device.device_id} and module_id ${device.module_id}:`, err);
        return {
          device_id: device.device_id,
          module_id: device.module_id,
          latest_event: null, // Handle errors gracefully
        };
      }
    });

    // Wait for all device events to be fetched
    const devicesWithLatestEvents = await Promise.all(deviceEventPromises);

    // Return the data along with the latest events
    res.status(200).json({
      message: "Devices with latest events fetched successfully",
      data: devicesWithLatestEvents,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ message: "Error fetching data", error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});