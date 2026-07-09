const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const router = express.Router();

/**
 * POST /api/pterodactyl/assign-port
 * Assigns a port to a Pterodactyl server
 * Steps:
 * 1. Read Panel URL and API Key from config.json
 * 2. Get server details from Pterodactyl API
 * 3. Create allocation if necessary
 * 4. Assign allocation to server
 */
router.post('/assign-port', async (req, res) => {
  try {
    const { serverId, nodeIp, port } = req.body;

    // Input validation
    if (!serverId || !nodeIp || !port) {
      return res.status(400).json({ error: 'Server ID, Node IP, and Port are required' });
    }

    // Validate port number
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      return res.status(400).json({ error: 'Port must be between 1024 and 65535' });
    }

    // Validate IP address
    if (!isValidIP(nodeIp)) {
      return res.status(400).json({ error: 'Invalid Node IP address' });
    }

    // Read configuration
    const configPath = path.join(__dirname, '../config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.panelUrl || !config.apiKey) {
      return res.status(400).json({ error: 'Configuration not set. Please set up your Panel URL and API Key.' });
    }

    // API headers for Pterodactyl
    const headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Step 1: Get server details to find node ID
    let nodeId;
    try {
      const serverResponse = await axios.get(
        `${config.panelUrl}/api/application/servers/${serverId}`,
        { headers }
      );
      nodeId = serverResponse.data.data.node;
    } catch (error) {
      return res.status(400).json({
        error: 'Failed to find server',
        details: error.response?.data?.errors?.[0]?.detail || error.message
      });
    }

    // Step 2: Check if allocation already exists on this node/IP/port
    let allocationId;
    try {
      const allocationsResponse = await axios.get(
        `${config.panelUrl}/api/application/nodes/${nodeId}/allocations`,
        { headers }
      );

      // Look for existing allocation with same IP and port
      const existingAllocation = allocationsResponse.data.data.find(
        alloc => alloc.attributes.ip === nodeIp && alloc.attributes.port === portNum && !alloc.attributes.server_id
      );

      if (existingAllocation) {
        allocationId = existingAllocation.attributes.id;
      } else {
        // Step 3: Create new allocation if it doesn't exist
        try {
          const createResponse = await axios.post(
            `${config.panelUrl}/api/application/nodes/${nodeId}/allocations`,
            {
              ip: nodeIp,
              ports: [`${portNum}`]
            },
            { headers }
          );
          allocationId = createResponse.data.data[0].attributes.id;
        } catch (error) {
          return res.status(400).json({
            error: 'Failed to create allocation',
            details: error.response?.data?.errors?.[0]?.detail || error.message
          });
        }
      }
    } catch (error) {
      return res.status(400).json({
        error: 'Failed to retrieve allocations',
        details: error.response?.data?.errors?.[0]?.detail || error.message
      });
    }

    // Step 4: Assign allocation to server
    try {
      const assignResponse = await axios.post(
        `${config.panelUrl}/api/application/servers/${serverId}/network/allocations`,
        {
          allocation_id: allocationId
        },
        { headers }
      );

      res.json({
        success: true,
        message: 'Port assigned successfully',
        allocation: {
          id: allocationId,
          ip: nodeIp,
          port: portNum,
          serverId: serverId
        },
        apiResponse: assignResponse.data.data
      });
    } catch (error) {
      return res.status(400).json({
        error: 'Failed to assign allocation to server',
        details: error.response?.data?.errors?.[0]?.detail || error.message
      });
    }
  } catch (error) {
    console.error('Assign port error:', error);
    res.status(500).json({ error: 'An error occurred while assigning the port' });
  }
});

/**
 * GET /api/pterodactyl/servers
 * Retrieves list of servers from Pterodactyl panel
 */
router.get('/servers', async (req, res) => {
  try {
    const configPath = path.join(__dirname, '../config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.panelUrl || !config.apiKey) {
      return res.status(400).json({ error: 'Configuration not set' });
    }

    const headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const response = await axios.get(
      `${config.panelUrl}/api/application/servers`,
      { headers }
    );

    const servers = response.data.data.map(server => ({
      id: server.attributes.id,
      name: server.attributes.name,
      owner_id: server.attributes.owner_id,
      node: server.attributes.node
    }));

    res.json({
      success: true,
      servers: servers
    });
  } catch (error) {
    console.error('Servers fetch error:', error);
    res.status(400).json({
      error: 'Failed to retrieve servers',
      details: error.response?.data?.errors?.[0]?.detail || error.message
    });
  }
});

/**
 * GET /api/pterodactyl/nodes
 * Retrieves list of nodes from Pterodactyl panel
 */
router.get('/nodes', async (req, res) => {
  try {
    const configPath = path.join(__dirname, '../config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.panelUrl || !config.apiKey) {
      return res.status(400).json({ error: 'Configuration not set' });
    }

    const headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const response = await axios.get(
      `${config.panelUrl}/api/application/nodes`,
      { headers }
    );

    const nodes = response.data.data.map(node => ({
      id: node.attributes.id,
      name: node.attributes.name,
      fqdn: node.attributes.fqdn
    }));

    res.json({
      success: true,
      nodes: nodes
    });
  } catch (error) {
    console.error('Nodes fetch error:', error);
    res.status(400).json({
      error: 'Failed to retrieve nodes',
      details: error.response?.data?.errors?.[0]?.detail || error.message
    });
  }
});

/**
 * Helper function to validate IP address format
 * @param {string} ip - IP address to validate
 * @returns {boolean} - True if valid IP address
 */
function isValidIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    return false;
  }
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part);
    return num >= 0 && num <= 255;
  });
}

module.exports = router;
