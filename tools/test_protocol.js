#!/usr/bin/env node
/**
 * Quick test for Binary Frame Protocol - PING/PONG test
 * Usage: node test_protocol.js [COM_PORT]
 */

const { SerialPort } = require('serialport');

// CRC-16/CCITT (matches firmware's crc16.cpp, init=0x0000)
function crc16Ccitt(data) {
    let crc = 0x0000;
    for (const byte of data) {
        crc ^= byte << 8;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x8000) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc;
}

// Build a complete protocol frame: MAGIC + CMD + LENGTH + DATA + CRC
function buildFrame(cmd, payload = Buffer.alloc(0)) {
    const magic = Buffer.from([0xEB, 0x0D]);
    const length = Buffer.alloc(4);
    length.writeUInt32LE(payload.length);
    const headerAndData = Buffer.concat([Buffer.from([cmd]), length, payload]);
    const crc = crc16Ccitt(headerAndData);
    const crcBytes = Buffer.alloc(2);
    crcBytes.writeUInt16LE(crc);
    return Buffer.concat([magic, headerAndData, crcBytes]);
}

const RESP_NAMES = {
    0x80: 'PONG',
    0x81: 'ACK',
    0x82: 'NAK',
    0x83: 'DISPLAY_DONE',
};

async function main() {
    const port = process.argv[2] || 'COM5';
    console.log(`Opening ${port} at 115200 baud...`);

    const sp = new SerialPort({ path: port, baudRate: 115200 });

    await new Promise((resolve, reject) => {
        sp.on('open', resolve);
        sp.on('error', reject);
    });

    // Drain existing data
    sp.flush();

    // Send PING frame
    const pingFrame = buildFrame(0xFF); // CMD_PING
    console.log(`Sending PING: ${pingFrame.toString('hex').match(/../g).join(' ')}`);
    sp.write(pingFrame);

    // Wait for PONG response (3 bytes: 0xEB 0x0D 0x80)
    console.log('Waiting for response...');
    const start = Date.now();

    const resp = await new Promise((resolve) => {
        let buf = Buffer.alloc(0);
        const timer = setTimeout(() => {
            sp.close();
            resolve(buf);
        }, 3000);

        sp.on('data', (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            if (buf.length >= 3) {
                clearTimeout(timer);
                sp.close();
                resolve(buf.subarray(0, 3));
            }
        });
    });

    const elapsed = Date.now() - start;

    if (resp.length >= 3 && resp[0] === 0xEB && resp[1] === 0x0D) {
        const respCmd = resp[2];
        const name = RESP_NAMES[respCmd] || `UNKNOWN(0x${respCmd.toString(16).padStart(2, '0')})`;
        console.log(`✓ Response in ${elapsed}ms: ${resp.toString('hex').match(/../g).join(' ')} → ${name}`);
    } else if (resp.length > 0) {
        console.log(`✗ Unexpected response: ${resp.toString('hex').match(/../g).join(' ')}`);
    } else {
        console.log(`✗ No response (timeout after ${elapsed}ms)`);
    }

    console.log('Done.');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
