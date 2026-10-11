import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COVER_PRE_TRANSFORMATION,
  coverFolder,
  coverUpload,
  coverUrl,
  coverWithUrl,
  customCoverSchema,
  isCoverPath,
  UPLOAD_URL,
  uploadSignature,
} from "@/server/imagekit";

const PRIVATE_KEY = "private_test_key";
const USER = "user_2abc";
const TRIP = "11111111-1111-4111-8111-111111111111";

afterEach(() => vi.unstubAllEnvs());

describe("uploadSignature", () => {
  it("is the hex HMAC-SHA1 of token + expire, as ImageKit's reference code computes it", async () => {
    const expected = createHmac("sha1", PRIVATE_KEY).update(`some-token${1760000000}`).digest("hex");
    expect(await uploadSignature(PRIVATE_KEY, "some-token", 1760000000)).toBe(expected);
  });
});

describe("coverUpload", () => {
  it("signs an upload into the trip's folder, valid for less than an hour, without the private key", async () => {
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", PRIVATE_KEY);
    vi.stubEnv("IMAGEKIT_PUBLIC_KEY", "public_test_key");
    const now = Math.floor(Date.now() / 1000);

    const upload = await coverUpload(USER, TRIP, "image/png");

    expect(upload.url).toBe(UPLOAD_URL);
    const { fields } = upload;
    expect(fields.publicKey).toBe("public_test_key");
    expect(fields.folder).toBe(`/tripagent/covers/${USER}/${TRIP}`);
    expect(fields.fileName).toBe("cover.png");
    expect(fields.useUniqueFileName).toBe("true");
    expect(JSON.parse(fields.transformation)).toEqual({ pre: COVER_PRE_TRANSFORMATION });
    expect(fields.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number(fields.expire)).toBeGreaterThan(now);
    expect(Number(fields.expire)).toBeLessThan(now + 3600);
    expect(fields.signature).toBe(createHmac("sha1", PRIVATE_KEY).update(fields.token + fields.expire).digest("hex"));
    expect(Object.values(fields)).not.toContain(PRIVATE_KEY);
  });

  it("names the file .jpg when the type is unknown and uses a new token each time", async () => {
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", PRIVATE_KEY);
    vi.stubEnv("IMAGEKIT_PUBLIC_KEY", "public_test_key");
    const first = await coverUpload(USER, TRIP);
    const second = await coverUpload(USER, TRIP, "application/octet-stream");
    expect(first.fields.fileName).toBe("cover.jpg");
    expect(second.fields.fileName).toBe("cover.jpg");
    expect(first.fields.token).not.toBe(second.fields.token);
  });

  it("fails without the ImageKit keys", async () => {
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "");
    vi.stubEnv("IMAGEKIT_PUBLIC_KEY", "");
    await expect(coverUpload(USER, TRIP, "image/jpeg")).rejects.toThrow(/IMAGEKIT_(PUBLIC|PRIVATE)_KEY is not set/);
  });
});

describe("isCoverPath", () => {
  const folder = coverFolder(USER, TRIP);

  it("accepts a file right inside the trip's folder", () => {
    expect(isCoverPath(`${folder}/cover_Ab12-xY.jpg`, USER, TRIP)).toBe(true);
    expect(isCoverPath(`${folder}/cover`, USER, TRIP)).toBe(true);
  });

  it("refuses another user's or trip's folder, a folder outside the app's, a nested path, a traversal and the folder itself", () => {
    expect(isCoverPath(`/tripagent/covers/user_other/${TRIP}/cover.jpg`, USER, TRIP)).toBe(false);
    expect(isCoverPath(`/tripagent/covers/${USER}/22222222-2222-4222-8222-222222222222/cover.jpg`, USER, TRIP)).toBe(false);
    expect(isCoverPath(`/tripagent/other/${USER}/${TRIP}/cover.jpg`, USER, TRIP)).toBe(false);
    expect(isCoverPath(`/covers/${USER}/${TRIP}/cover.jpg`, USER, TRIP)).toBe(false);
    expect(isCoverPath(`${folder}/sub/cover.jpg`, USER, TRIP)).toBe(false);
    expect(isCoverPath(`${folder}/../cover.jpg`, USER, TRIP)).toBe(false);
    expect(isCoverPath(`${folder}/cover.jpg?tr=w-10`, USER, TRIP)).toBe(false);
    expect(isCoverPath(`${folder}/`, USER, TRIP)).toBe(false);
    expect(isCoverPath(folder, USER, TRIP)).toBe(false);
  });
});

describe("customCoverSchema", () => {
  it("takes what ImageKit answers and refuses empty values", () => {
    const answer = { fileId: "6286329dfef1b033aee60211", filePath: "/tripagent/covers/u/t/cover_x.jpg" };
    expect(customCoverSchema.safeParse(answer).success).toBe(true);
    expect(customCoverSchema.safeParse({ ...answer, fileId: "" }).success).toBe(false);
    expect(customCoverSchema.safeParse({ fileId: "x" }).success).toBe(false);
  });
});

describe("coverUrl", () => {
  it("joins the URL endpoint and the file path, whatever the trailing slash", () => {
    vi.stubEnv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/demo/");
    expect(coverUrl("/tripagent/covers/u/t/cover_x.jpg")).toBe("https://ik.imagekit.io/demo/tripagent/covers/u/t/cover_x.jpg");
    expect(coverWithUrl({ fileId: "f", filePath: "/tripagent/covers/u/t/cover_x.jpg" })).toEqual({
      fileId: "f",
      filePath: "/tripagent/covers/u/t/cover_x.jpg",
      url: "https://ik.imagekit.io/demo/tripagent/covers/u/t/cover_x.jpg",
    });
    expect(coverWithUrl(null)).toBeNull();
  });
});
