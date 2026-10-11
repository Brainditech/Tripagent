import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COVER_PRE_TRANSFORMATION,
  coverFolder,
  coverUpload,
  coverUrl,
  coverWithUrl,
  customCoverSchema,
  deleteFile,
  deleteFolder,
  fileDetails,
  isCoverPath,
  tryDeleteFile,
  UPLOAD_URL,
  uploadSignature,
  userCoverFolder,
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
  it("needs the file id, tolerates the path the app sends along and refuses empty ids", () => {
    const answer = { fileId: "6286329dfef1b033aee60211", filePath: "/tripagent/covers/u/t/cover_x.jpg" };
    expect(customCoverSchema.safeParse(answer).success).toBe(true);
    expect(customCoverSchema.safeParse({ fileId: "x" }).success).toBe(true);
    expect(customCoverSchema.safeParse({ ...answer, fileId: "" }).success).toBe(false);
    expect(customCoverSchema.safeParse({}).success).toBe(false);
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

describe("management API", () => {
  const AUTH = `Basic ${Buffer.from(`${PRIVATE_KEY}:`).toString("base64")}`;

  /** A fetch stub answering `status` with `body`, remembering the request. */
  function fetchStub(status: number, body: unknown = null) {
    return vi.fn(async () => new Response(body === null ? null : JSON.stringify(body), { status })) as unknown as typeof fetch;
  }
  const requestOf = (stub: typeof fetch) => (stub as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];

  it("reads a file back with the private key as Basic auth, as ImageKit stored it", async () => {
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", PRIVATE_KEY);
    const path = `${coverFolder(USER, TRIP)}/cover_x.jpg`;
    const fetch = fetchStub(200, { fileId: "f1", filePath: path, fileType: "image", size: 169000 });
    const file = await fileDetails("f1", fetch);
    const [url, init] = requestOf(fetch);
    expect(url).toBe("https://api.imagekit.io/v1/files/f1/details");
    expect((init.headers as Record<string, string>).Authorization).toBe(AUTH);
    expect(file).toEqual({ fileId: "f1", filePath: path, fileType: "image", size: 169000 });
  });

  it("answers null for an unknown file and fails on any other error or a malformed answer", async () => {
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", PRIVATE_KEY);
    expect(await fileDetails("missing", fetchStub(404, { message: "no file" }))).toBeNull();
    await expect(fileDetails("f1", fetchStub(500, { message: "oops" }))).rejects.toThrow(/500/);
    await expect(fileDetails("f1", fetchStub(200, { fileId: "f1" }))).rejects.toThrow(/without a path/);
  });

  it("deletes a file and treats a file already gone as deleted", async () => {
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", PRIVATE_KEY);
    const fetch = fetchStub(204);
    await deleteFile("f1", fetch);
    const [url, init] = requestOf(fetch);
    expect(url).toBe("https://api.imagekit.io/v1/files/f1");
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>).Authorization).toBe(AUTH);
    await expect(deleteFile("f1", fetchStub(404))).resolves.toBeUndefined();
    await expect(deleteFile("f1", fetchStub(500))).rejects.toThrow(/500/);
  });

  it("tryDeleteFile reports a failure instead of throwing", async () => {
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", PRIVATE_KEY);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await tryDeleteFile("f1", fetchStub(204))).toBe(true);
    expect(await tryDeleteFile("f1", fetchStub(500))).toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("deletes a user's cover folder by its path and treats a folder already gone as deleted", async () => {
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", PRIVATE_KEY);
    const fetch = fetchStub(200, { message: "Folder deleted successfully" });
    await deleteFolder(userCoverFolder(USER), fetch);
    const [url, init] = requestOf(fetch);
    expect(url).toBe("https://api.imagekit.io/v1/folder/");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ folderPath: `/tripagent/covers/${USER}` });
    await expect(deleteFolder("/tripagent/covers/nobody", fetchStub(404, { reason: "FOLDER_NOT_FOUND" }))).resolves.toBeUndefined();
    await expect(deleteFolder("/tripagent/covers/x", fetchStub(500))).rejects.toThrow(/500/);
  });

  it("fails without the private key", async () => {
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "");
    await expect(fileDetails("f1", fetchStub(200, {}))).rejects.toThrow(/IMAGEKIT_PRIVATE_KEY is not set/);
  });
});
