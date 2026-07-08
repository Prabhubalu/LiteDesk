<?php
/**
 * Arivu headless help — incremental static sync (PHP)
 *
 * 1. Upload this file to your web host.
 * 2. Set config below.
 * 3. Point Arivu Articles → Publish webhook URL to this script.
 * 4. Run once with ?full=1 for initial sync.
 */

declare(strict_types=1);

$config = [
    'org' => getenv('ARIVU_ORG') ?: 'art_pub_REPLACE_ME',
    'apiOrigin' => rtrim(getenv('ARIVU_API_ORIGIN') ?: 'https://app.arivu.com', '/'),
    'outputDir' => __DIR__ . '/help',
    'pathPrefix' => '/help/',
    'siteOrigin' => rtrim(getenv('SITE_ORIGIN') ?: '', '/'),
    'webhookSecret' => getenv('ARIVU_WEBHOOK_SECRET') ?: '',
];

function respondJson(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload);
    exit;
}

function verifyWebhookSignature(string $rawBody, string $secret, string $header): bool
{
    if ($secret === '') {
        return true;
    }
    if ($header === '' || !str_starts_with($header, 'sha256=')) {
        return false;
    }
    $expected = hash_hmac('sha256', $rawBody, $secret);
    $received = substr($header, strlen('sha256='));
    return hash_equals($expected, $received);
}

function fetchJson(string $url): array
{
    $context = stream_context_create(['http' => ['timeout' => 20]]);
    $raw = file_get_contents($url, false, $context);
    if ($raw === false) {
        throw new RuntimeException('Failed to fetch ' . $url);
    }
    $payload = json_decode($raw, true);
    if (!is_array($payload) || empty($payload['success'])) {
        throw new RuntimeException('Invalid API response from ' . $url);
    }
    return $payload;
}

function fetchText(string $url): string
{
    $context = stream_context_create(['http' => ['timeout' => 20]]);
    $raw = file_get_contents($url, false, $context);
    if ($raw === false) {
        throw new RuntimeException('Failed to fetch ' . $url);
    }
    return $raw;
}

function ensureDir(string $filePath): void
{
    $dir = dirname($filePath);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
}

function writeFile(string $path, string $contents): void
{
    ensureDir($path);
    file_put_contents($path, $contents);
}

function contentBase(array $config): string
{
    return $config['apiOrigin'] . '/api/public/v1/content/' . rawurlencode($config['org']);
}

function syncPageExport(array $config, array $page): array
{
    $base = contentBase($config);
    $query = http_build_query(['pathPrefix' => $config['pathPrefix']]);
    if (($page['type'] ?? '') === 'home') {
        $export = fetchJson($base . '/export/home?' . $query);
    } else {
        $slug = (string) ($page['slug'] ?? '');
        $params = ['pathPrefix' => $config['pathPrefix']];
        if (!empty($page['parentSlug'])) {
            $params['parent'] = (string) $page['parentSlug'];
        }
        $export = fetchJson($base . '/export/collections/' . rawurlencode($slug) . '?' . http_build_query($params));
    }
    $data = $export['data'] ?? [];
    $exportPath = ltrim((string) ($data['exportPath'] ?? ''), '/');
    $destination = rtrim($config['outputDir'], '/') . '/' . $exportPath;
    writeFile($destination, (string) ($data['html'] ?? ''));
    return ['type' => (string) ($data['type'] ?? 'page'), 'destination' => $destination];
}

function syncArticle(array $config, string $slug): array
{
    $base = contentBase($config);
    $query = http_build_query(['pathPrefix' => $config['pathPrefix']]);
    $export = fetchJson($base . '/articles/' . rawurlencode($slug) . '/export?' . $query);
    $data = $export['data'] ?? [];
    $html = (string) ($data['html'] ?? '');
    $exportPath = ltrim((string) ($data['exportPath'] ?? ''), '/');
    $destination = rtrim($config['outputDir'], '/') . '/' . $exportPath;

    foreach (($data['assets'] ?? []) as $asset) {
        $assetUrl = (string) ($asset['url'] ?? '');
        $filename = (string) ($asset['filename'] ?? '');
        if ($assetUrl === '' || $filename === '') {
            continue;
        }
        $assetBytes = file_get_contents($assetUrl);
        if ($assetBytes === false) {
            continue;
        }
        $assetDest = rtrim($config['outputDir'], '/') . '/help/assets/' . $filename;
        writeFile($assetDest, $assetBytes);
        $publicAssetPath = '/help/assets/' . $filename;
        $html = str_replace($assetUrl, $publicAssetPath, $html);
    }

    writeFile($destination, $html);
    return ['slug' => $slug, 'destination' => $destination];
}

function syncRefreshPages(array $config, array $pages): array
{
    $results = [];
    foreach ($pages as $page) {
        if (!is_array($page)) {
            continue;
        }
        $results[] = syncPageExport($config, $page);
    }
    return $results;
}

function deleteArticle(array $config, string $exportPath): array
{
    $relative = ltrim($exportPath, '/');
    $destination = rtrim($config['outputDir'], '/') . '/' . $relative;
    if (is_file($destination)) {
        unlink($destination);
        return ['removed' => true, 'destination' => $destination];
    }
    return ['removed' => false, 'destination' => $destination];
}

function writeSitemap(array $config): array
{
    $params = ['pathPrefix' => $config['pathPrefix']];
    if ($config['siteOrigin'] !== '') {
        $params['siteOrigin'] = $config['siteOrigin'];
    }
    $xml = fetchText(contentBase($config) . '/export/sitemap.xml?' . http_build_query($params));
    $destination = rtrim($config['outputDir'], '/') . rtrim($config['pathPrefix'], '/') . '/sitemap.xml';
    writeFile($destination, $xml);
    return ['destination' => $destination];
}

function handleWebhook(array $config): void
{
    $raw = file_get_contents('php://input') ?: '';
    $signature = (string) ($_SERVER['HTTP_X_ARIVU_SIGNATURE'] ?? '');
    if (!verifyWebhookSignature($raw, (string) $config['webhookSecret'], $signature)) {
        respondJson(401, ['success' => false, 'message' => 'Invalid signature']);
    }

    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        respondJson(400, ['success' => false, 'message' => 'Invalid JSON payload']);
    }

    $event = (string) ($payload['event'] ?? '');
    $content = is_array($payload['content'] ?? null) ? $payload['content'] : [];
    $refreshPages = is_array($content['refreshPages'] ?? null) ? $content['refreshPages'] : [];

    if ($event === 'content.published') {
        $result = syncArticle($config, (string) ($content['slug'] ?? ''));
        $result['refreshPages'] = syncRefreshPages($config, $refreshPages);
        respondJson(200, ['success' => true, 'result' => $result]);
    }

    if ($event === 'content.unpublished') {
        $result = deleteArticle($config, (string) ($content['exportPath'] ?? ''));
        $result['refreshPages'] = syncRefreshPages($config, $refreshPages);
        respondJson(200, ['success' => true, 'result' => $result]);
    }

    respondJson(400, ['success' => false, 'message' => 'Unsupported event']);
}

function runFullSync(array $config): void
{
    $base = contentBase($config);
    $manifest = fetchJson($base . '/manifest.json?pathPrefix=' . rawurlencode($config['pathPrefix']));
    $results = [];
    foreach (($manifest['data']['pages'] ?? []) as $page) {
        $results[] = syncPageExport($config, is_array($page) ? $page : []);
    }
    foreach (($manifest['data']['articles'] ?? []) as $article) {
        $results[] = syncArticle($config, (string) ($article['slug'] ?? ''));
    }
    $sitemap = writeSitemap($config);
    respondJson(200, ['success' => true, 'count' => count($results), 'results' => $results, 'sitemap' => $sitemap]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    handleWebhook($config);
}

if (isset($_GET['full'])) {
    runFullSync($config);
}

respondJson(200, ['success' => true, 'message' => 'Arivu help sync ready']);
