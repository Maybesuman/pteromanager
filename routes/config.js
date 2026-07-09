const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

/**
 * GET /api/config
 * Retrieves current configuration (Panel URL and API Key)
 */
router.get('/', (req, res) => {
  try {
    const configPath = path.join(__dirname, '../config.json');
    
    // Check if config file exists
    if (!fs.existsSync(configPath)) {
      return res.json({
        panelUrl: '',
        apiKey: ''
      });
    }

    // Read and parse config file
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    res.json({
      panelUrl: config.panelUrl || '',
      apiKey: config.apiKey || ''
    });
  } catch (error) {
    console.error('Config read error:', error);
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

/**
 * POST /api/config
 * Saves configuration (Panel URL and API Key)
 * Validates input before saving
 */
router.post('/', (req, res) => {
  try {
    const { panelUrl, apiKey } = req.body;

    // Input validation
    if (!panelUrl || !apiKey) {
      return res.status(400).json({ error: 'Panel URL and API Key are required' });
    }

    // Validate Panel URL format
    try {
      new URL(panelUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid Panel URL format' });
    }

    // Validate API Key format (should start with ptla_)
    if (!apiKey.startsWith('ptla_')) {
      return res.status(400).json({ error: 'API Key must start with ptla_' });
    }

    // Create config object
    const config = {
      panelUrl: panelUrl.trim(),
      apiKey: apiKey.trim()
    };

    // Write to config.json file
    const configPath = path.join(__dirname, '../config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    res.json({
      success: true,
      message: 'Configuration saved successfully',
      config: config
    });
  } catch (error) {
    console.error('Config save error:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

/**
 * POST /api/config/validate
 * Validates the Pterodactyl API connection
 */
router.post('/validate', (req, res) => {
  try {
    const axios = require('axios');
    const configPath = path.join(__dirname, '../config.json');

    // Read current config
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.panelUrl || !config.apiKey) {
      return res.status(400).json({ error: 'Configuration not set' });
    }

    // Test API connection with a simple request
    axios.get(`${config.panelUrl}/api/application/servers`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }).then(response => {
      res.json({
        success: true,
        message: 'API connection validated successfully',
        serverCount: response.data.meta?.pagination?.total || 0
      });
    }).catch(error => {
      console.error('API validation error:', error.message);
      res.status(400).json({
        error: 'Failed to validate API connection',
        details: error.response?.data?.errors?.[0]?.detail || error.message
      });
    });
  } catch (error) {
    console.error('Config validation error:', error);
    res.status(500).json({ error: 'Failed to validate configuration' });
  }
});

module.exports = router;
