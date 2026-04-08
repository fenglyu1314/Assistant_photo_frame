#!/usr/bin/env node
/**
 * Full display test for Binary Frame Protocol
 * Sends a solid RED pattern to verify the complete display chain:
 *   BEGIN → DATA(×47) → END → DISPLAY_DONE
 * 
 * Usage: node test_display.js [COM_PORT]
 */

const { SerialPort } = require('serialport');

// ============================================================================
// CRC-16/CCITT (matches firmware crc16.cpp, init=0x0000)
// ============================================================================

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

// ============================================================================
// Frame builder
// ============================================================================

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

// ============================================================================
// Protocol constants
// ============================================================================

const CMD_BEGIN = 0x01;
const CMD_DATA  = 0x02;
const CMD_END   = 0x03;

const RESP_PONG        = 0x80;
const RESP_ACK         = 0x81;
const RESP_NAK         = 0x82;
const RESP_DISPLAY_DONE = 0x83;

const RESP_NAMES = {
    0x80: 'PONG',
    0x81: 'ACK',
    0x82: 'NAK',
    0x83: 'DISPLAY_DONE',
};

const FRAME_BUFFER_SIZE = 192000;  // 800/2 * 480
const CHUNK_SIZE        = 4096;
const TOTAL_CHUNKS      = Math.ceil(FRAME_BUFFER_SIZE / CHUNK_SIZE);  // 47

// Color indices: BLACK=0, WHITE=1, YELLOW=2, RED=3, (4=skip), BLUE=5, GREEN=6
const COLOR_RED   = 0x33;  // Upper nibble=RED, Lower nibble=RED (packed 4-bit)
const COLOR_BLACK = 0x00;
const COLOR_WHITE = 0x11;
const COLOR_BLUE  = 0x55;

// ============================================================================
// Serial helper: wait for a specific response
// ============================================================================

function waitResponse(sp, expectedResp, timeoutMs = 5000) {
    return new Promise((resolve) => {
        let buf = Buffer.alloc(0);
        let done = false;

        const timer = setTimeout(() => {
            if (!done) {
                done = true;
                sp.removeListener('data', onData);
                resolve({ ok: false, data: buf, timeout: true });
            }
        }, timeoutMs);

        function onData(chunk) {
            if (done) return;
            buf = Buffer.concat([buf, chunk]);
            for (let i = 0; i <= buf.length - 3; i++) {
                if (buf[i] === 0xEB && buf[i + 1] === 0x0D && buf[i + 2] === expectedResp) {
                    done = true;
                    clearTimeout(timer);
                    sp.removeListener('data', onData);
                    const respData = buf.subarray(i, i + (expectedResp === RESP_ACK || expectedResp === RESP_NAK ? 5 : 3));
                    resolve({ ok: true, data: respData, timeout: false });
                    return;
                }
            }
        }

        sp.on('data', onData);
    });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const port = process.argv[2] || 'COM5';
    console.log(`=== Display Test on ${port} ===`);
    console.log(`Frame buffer: ${FRAME_BUFFER_SIZE} bytes, ${TOTAL_CHUNKS} chunks of ${CHUNK_SIZE} bytes\n`);

    const sp = new SerialPort({ path: port, baudRate: 115200 });
    await new Promise((resolve, reject) => {
        sp.on('open', resolve);
        sp.on('error', reject);
    });

    // Build frame buffer: top half RED, bottom half BLACK
    const framebuf = Buffer.alloc(FRAME_BUFFER_SIZE, COLOR_BLACK);
    // Fill top half with RED
    const halfSize = Math.floor(FRAME_BUFFER_SIZE / 2);
    framebuf.fill(COLOR_RED, 0, halfSize);

    console.log(`Pattern: top half RED (0x33), bottom half BLACK (0x00)`);

    // ---- Step 1: BEGIN ----
    const beginPayload = Buffer.alloc(8);
    beginPayload.writeUInt32LE(FRAME_BUFFER_SIZE, 0);  // total_size
    beginPayload.writeUInt16LE(CHUNK_SIZE, 4);          // chunk_size
    beginPayload.writeUInt16LE(TOTAL_CHUNKS, 6);        // total_chunks

    const beginFrame = buildFrame(CMD_BEGIN, beginPayload);
    console.log(`\n[1] Sending BEGIN...`);
    sp.write(beginFrame);

    const beginResp = await waitResponse(sp, RESP_ACK, 3000);
    if (!beginResp.ok) {
        console.log(`    ✗ No ACK for BEGIN`);
        sp.close();
        return;
    }
    console.log(`    ✓ ACK received for BEGIN`);

    // ---- Step 2: DATA chunks ----
    let nakCount = 0;
    for (let i = 0; i < TOTAL_CHUNKS; i++) {
        const chunkStart = i * CHUNK_SIZE;
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, FRAME_BUFFER_SIZE);
        const chunkData = framebuf.subarray(chunkStart, chunkEnd);

        // Payload: chunk_index(2 bytes LE) + chunk_data
        const payload = Buffer.alloc(2 + chunkData.length);
        payload.writeUInt16LE(i, 0);
        chunkData.copy(payload, 2);

        const dataFrame = buildFrame(CMD_DATA, payload);
        sp.write(dataFrame);

        const resp = await waitResponse(sp, RESP_ACK, 3000);
        if (resp.ok) {
            const chunkIdx = resp.data.readUInt16LE(3);
            if (chunkIdx !== i) {
                console.log(`    ⚠ ACK chunk ${chunkIdx}, expected ${i}`);
            }
        } else {
            console.log(`    ✗ No ACK for chunk ${i}`);
            nakCount++;
        }

        // Progress
        if ((i + 1) % 10 === 0 || i === TOTAL_CHUNKS - 1) {
            process.stdout.write(`\r    Progress: ${i + 1}/${TOTAL_CHUNKS} chunks`);
        }
    }
    console.log(nakCount > 0 ? `\n    ⚠ ${nakCount} chunks failed` : `\n    ✓ All chunks ACK'd`);

    // ---- Step 3: END ----
    const endFrame = buildFrame(CMD_END);
    console.log(`\n[3] Sending END...`);
    sp.write(endFrame);

    const endResp = await waitResponse(sp, RESP_DISPLAY_DONE, 30000);  // EPD refresh takes ~12s
    if (endResp.ok) {
        console.log(`    ✓ DISPLAY_DONE received! Screen should be updating.`);
    } else {
        // Might get NAK if transfer was incomplete
        console.log(`    ✗ No DISPLAY_DONE (timeout or error)`);
    }

    sp.close();
    console.log('\n=== Test complete ===');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
