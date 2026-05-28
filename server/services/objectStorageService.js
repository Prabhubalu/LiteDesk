const AWS = require('aws-sdk');
const crypto = require('crypto');

function parseBool(v) {
  return String(v || '').trim().toLowerCase() === 'true';
}

function getS3() {
  const endpoint = String(process.env.STORAGE_ENDPOINT || '').trim();
  const region = String(process.env.STORAGE_REGION || '').trim();
  const accessKeyId = String(process.env.STORAGE_ACCESS_KEY || '').trim();
  const secretAccessKey = String(process.env.STORAGE_SECRET_KEY || '').trim();
  const s3ForcePathStyle = parseBool(process.env.STORAGE_FORCE_PATH_STYLE);

  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    const err = new Error('Object storage is not configured (STORAGE_ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY required)');
    err.statusCode = 500;
    throw err;
  }

  return new AWS.S3({
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    s3ForcePathStyle,
    signatureVersion: 'v4'
  });
}

function getBucket() {
  const bucket = String(process.env.STORAGE_BUCKET || '').trim();
  if (!bucket) {
    const err = new Error('Object storage bucket is not configured (STORAGE_BUCKET required)');
    err.statusCode = 500;
    throw err;
  }
  return bucket;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function putBuffer({ key, buffer, contentType = 'application/octet-stream', metadata = {} }) {
  const s3 = getS3();
  const Bucket = getBucket();
  await s3.putObject({
    Bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata
  }).promise();
  return { bucket: Bucket, key };
}

async function copyObject({ fromKey, toKey }) {
  const s3 = getS3();
  const Bucket = getBucket();
  await s3.copyObject({
    Bucket,
    Key: toKey,
    CopySource: `/${Bucket}/${encodeURIComponent(fromKey).replace(/%2F/g, '/')}`
  }).promise();
  return { bucket: Bucket, key: toKey };
}

async function deleteObject({ key }) {
  const s3 = getS3();
  const Bucket = getBucket();
  await s3.deleteObject({ Bucket, Key: key }).promise();
}

async function getObjectStream({ key }) {
  const s3 = getS3();
  const Bucket = getBucket();
  const stream = s3.getObject({ Bucket, Key: key }).createReadStream();
  return { bucket: Bucket, key, stream };
}

async function getBuffer({ key }) {
  const s3 = getS3();
  const Bucket = getBucket();
  const res = await s3.getObject({ Bucket, Key: key }).promise();
  const body = res?.Body;
  if (!body) return Buffer.from('');
  if (Buffer.isBuffer(body)) return body;
  return Buffer.from(body);
}

module.exports = {
  getBucket,
  sha256,
  putBuffer,
  copyObject,
  deleteObject,
  getObjectStream,
  getBuffer
};

