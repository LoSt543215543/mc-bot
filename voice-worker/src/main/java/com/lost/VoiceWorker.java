package com.lost;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.*;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class VoiceWorker {
    private static final byte MAGIC_BYTE = (byte) 0xFF;

    private static final byte PKT_MIC = 0x01;
    private static final byte PKT_AUTH = 0x05;
    private static final byte PKT_AUTH_ACK = 0x06;
    private static final byte PKT_KEEP_ALIVE = 0x08;
    private static final byte PKT_CONN_CHECK = 0x09;
    private static final byte PKT_CONN_CHECK_ACK = 0x0A;

    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private static DatagramSocket socket;
    private static InetAddress serverHost;
    private static int serverPort;

    private static byte[] secretBytes;
    private static UUID playerUuid;

    private static volatile boolean authenticated = false;
    private static volatile boolean validated = false;
    private static long sequenceNumber = 0L;

    private static final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private static final Gson gson = new Gson();

    public static void main(String[] args) {
        log("Java VoiceWorker initialized.");

        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line;
        try {
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                try {
                    JsonObject json = gson.fromJson(line, JsonObject.class);
                    handleCommand(json);
                } catch (Exception e) {
                    log("IPC Error: " + e.getMessage());
                }
            }
        } catch (IOException e) {
            log("IPC Read Error: " + e.getMessage());
        }
    }

    private static void handleCommand(JsonObject json) {
        String action = json.get("action").getAsString();

        if ("connect_hex".equals(action)) {
            String host = json.get("host").getAsString();
            int port = json.get("port").getAsInt();
            String secretHex = json.get("secretHex").getAsString();
            String playerUuidHex = json.get("playerUuidHex").getAsString();

            connect(host, port, hexToBytes(secretHex), parseUuid(playerUuidHex));
        } else if ("mic".equals(action)) {
            if (authenticated && validated && json.has("opus")) {
                String base64Opus = json.get("opus").getAsString();
                byte[] opusData = Base64.getDecoder().decode(base64Opus);
                try {
                    sendMicPacket(opusData);
                } catch (Exception e) {
                    log("Mic Error: " + e.getMessage());
                }
            }
        }
    }

    private static void connect(String host, int port, byte[] secret, UUID uuid) {
        try {
            if (socket != null && !socket.isClosed()) socket.close();

            serverHost = InetAddress.getByName(host);
            serverPort = port;
            secretBytes = secret;
            playerUuid = uuid;

            socket = new DatagramSocket();
            log("UDP Socket listening on port " + socket.getLocalPort() + " -> Target: " + serverHost + ":" + serverPort);

            new Thread(VoiceWorker::listenUdp, "UDP-Listener").start();

            sendAuth();
            scheduler.scheduleAtFixedRate(() -> {
                if (!authenticated) {
                    sendAuth();
                } else if (!validated) {
                    sendConnectionCheck();
                }
            }, 600, 600, TimeUnit.MILLISECONDS);

            scheduler.scheduleAtFixedRate(() -> {
                if (authenticated && validated) {
                    sendKeepAlive();
                }
            }, 2, 2, TimeUnit.SECONDS);

        } catch (Exception e) {
            log("Connect Error: " + e.getMessage());
        }
    }

    private static void listenUdp() {
        byte[] buf = new byte[4096];
        while (socket != null && !socket.isClosed()) {
            try {
                DatagramPacket packet = new DatagramPacket(buf, buf.length);
                socket.receive(packet);

                byte[] raw = Arrays.copyOf(packet.getData(), packet.getLength());
                byte[] decrypted = unwrapAndDecryptServerPacket(raw);
                if (decrypted == null || decrypted.length == 0) continue;

                byte pktId = decrypted[0];

                if (pktId == PKT_AUTH_ACK) {
                    if (!authenticated) {
                        authenticated = true;
                        log("SUCCESS_AUTH: Authenticated with voice server!");
                        sendConnectionCheck();
                    }
                } else if (pktId == PKT_CONN_CHECK_ACK) {
                    if (!validated) {
                        validated = true;
                        log("SUCCESS_VALIDATED: Proximity voice channel is READY!");
                    }
                }
            } catch (Exception e) {
                if (socket != null && !socket.isClosed()) {
                    log("UDP Recv Error: " + e.getMessage());
                }
            }
        }
    }

    private static void sendAuth() {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            DataOutputStream out = new DataOutputStream(baos);

            out.writeByte(PKT_AUTH);
            out.writeLong(playerUuid.getMostSignificantBits());
            out.writeLong(playerUuid.getLeastSignificantBits());
            out.write(secretBytes);

            byte[] wire = wrapClientPacket(baos.toByteArray());
            DatagramPacket dp = new DatagramPacket(wire, wire.length, serverHost, serverPort);
            socket.send(dp);
        } catch (Exception e) {
            log("Auth Send Error: " + e.getMessage());
        }
    }

    private static void sendConnectionCheck() {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            DataOutputStream out = new DataOutputStream(baos);
            out.writeByte(PKT_CONN_CHECK);

            byte[] wire = wrapClientPacket(baos.toByteArray());
            DatagramPacket dp = new DatagramPacket(wire, wire.length, serverHost, serverPort);
            socket.send(dp);
        } catch (Exception e) {
            log("ConnCheck Error: " + e.getMessage());
        }
    }

    private static void sendKeepAlive() {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            DataOutputStream out = new DataOutputStream(baos);
            out.writeByte(PKT_KEEP_ALIVE);

            byte[] wire = wrapClientPacket(baos.toByteArray());
            DatagramPacket dp = new DatagramPacket(wire, wire.length, serverHost, serverPort);
            socket.send(dp);
        } catch (Exception ignored) {}
    }

    private static void sendMicPacket(byte[] opusData) throws Exception {
        // Exact order from MicPacket.toBytes:
        // 1. writeByteArray(data) -> [VarInt len + raw opus]
        // 2. writeLong(sequenceNumber)
        // 3. writeBoolean(whispering)
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(baos);

        out.writeByte(PKT_MIC);
        writeVarInt(out, opusData.length);
        out.write(opusData);
        out.writeLong(sequenceNumber++);
        out.writeBoolean(false);

        byte[] wire = wrapClientPacket(baos.toByteArray());
        DatagramPacket dp = new DatagramPacket(wire, wire.length, serverHost, serverPort);
        socket.send(dp);
    }

    private static byte[] wrapClientPacket(byte[] unencryptedPayload) throws Exception {
        byte[] iv = new byte[GCM_IV_LENGTH];
        RANDOM.nextBytes(iv);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        SecretKeySpec keySpec = new SecretKeySpec(secretBytes, "AES");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);
        byte[] encrypted = cipher.doFinal(unencryptedPayload);

        ByteBuffer encWithIv = ByteBuffer.allocate(iv.length + encrypted.length);
        encWithIv.put(iv);
        encWithIv.put(encrypted);
        byte[] finalEncrypted = encWithIv.array();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(baos);

        out.writeByte(MAGIC_BYTE);
        out.writeLong(playerUuid.getMostSignificantBits());
        out.writeLong(playerUuid.getLeastSignificantBits());
        writeVarInt(out, finalEncrypted.length);
        out.write(finalEncrypted);

        return baos.toByteArray();
    }

    private static byte[] unwrapAndDecryptServerPacket(byte[] raw) {
        if (raw.length < 2 || raw[0] != MAGIC_BYTE) return null;
        try {
            int offset = 1;
            int encLen = 0;
            int size = 0;
            while (offset + size < raw.length) {
                byte b = raw[offset + size];
                encLen |= (b & 0x7F) << (size * 7);
                size++;
                if ((b & 0x80) == 0) break;
            }
            offset += size;

            if (offset + encLen > raw.length) return null;

            byte[] fullEncrypted = Arrays.copyOfRange(raw, offset, offset + encLen);
            if (fullEncrypted.length < GCM_IV_LENGTH) return null;

            byte[] iv = Arrays.copyOfRange(fullEncrypted, 0, GCM_IV_LENGTH);
            byte[] ciphertext = Arrays.copyOfRange(fullEncrypted, GCM_IV_LENGTH, fullEncrypted.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            SecretKeySpec keySpec = new SecretKeySpec(secretBytes, "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);
            return cipher.doFinal(ciphertext);
        } catch (Exception e) {
            return null;
        }
    }

    private static void writeVarInt(DataOutputStream out, int value) throws IOException {
        while ((value & -128) != 0) {
            out.writeByte((value & 127) | 128);
            value >>>= 7;
        }
        out.writeByte(value);
    }

    private static UUID parseUuid(String hex) {
        long most = Long.parseUnsignedLong(hex.substring(0, 16), 16);
        long least = Long.parseUnsignedLong(hex.substring(16, 32), 16);
        return new UUID(most, least);
    }

    private static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                                 + Character.digit(hex.charAt(i+1), 16));
        }
        return data;
    }

    private static void log(String msg) {
        System.out.println("[SVC-Java] " + msg);
        System.out.flush();
    }
}
