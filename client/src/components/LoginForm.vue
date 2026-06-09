<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';

const { t } = useI18n();

const email = ref('');
const password = ref('');
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const SESSION_TRANSFER_HASH_KEY = 'ld_session';
const loginNotice = ref('');

const resolveInstanceLoginTarget = (instance) => {
    if (!instance?.subdomain) return null;

    const configuredTemplate = import.meta.env.VITE_INSTANCE_LOCAL_REDIRECT_TEMPLATE;
    const localProtocol = window.location.protocol || 'http:';
    const localPort = window.location.port ? `:${window.location.port}` : '';
    const defaultLocalTarget = `${localProtocol}//${instance.subdomain}.localhost${localPort}`;
    const fallbackTarget = instance.frontendUrl || defaultLocalTarget;
    const template = import.meta.env.DEV ? (configuredTemplate || defaultLocalTarget) : fallbackTarget;

    return String(template)
        .replace('{subdomain}', instance.subdomain)
        .replace('{port}', window.location.port || '');
};

const applyTransferredSessionFromHash = async () => {
    const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const encoded = hashParams.get(SESSION_TRANSFER_HASH_KEY);
    if (!encoded) return;

    const applied = authStore.applySessionTransferPayload(encoded);
    if (!applied) return;

    window.history.replaceState({}, '', window.location.pathname + window.location.search);
    await router.replace('/platform/home');
};

const handleLogin = async () => {
    const success = await authStore.login({
        email: email.value,
        password: password.value
    });

    if (success) {
        const instance = authStore.lastLoginResult?.instance;
        const targetBaseUrl = resolveInstanceLoginTarget(instance);
        if (targetBaseUrl) {
            try {
                const target = new URL(targetBaseUrl);
                const isDifferentHost = target.host !== window.location.host;
                if (isDifferentHost) {
                    const transferPayload = authStore.buildSessionTransferPayload();
                    if (transferPayload) {
                        const redirectUrl = new URL('/login', target.origin);
                        redirectUrl.hash = `${SESSION_TRANSFER_HASH_KEY}=${encodeURIComponent(transferPayload)}`;
                        window.location.assign(redirectUrl.toString());
                        return;
                    }
                }
            } catch (_error) {
                // Fall through to in-app redirect.
            }
        }

        // Wait a tick to ensure user data is fully set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Phase 1G: Redirect to platform landing after login
        console.log('Redirecting to platform landing');
        router.push('/platform/home');
    }
};

onMounted(() => {
    if (String(route.query.verified || '') === '1') {
        loginNotice.value = t('auth.verifyEmailLoginNotice');
    }
    void applyTransferredSessionFromHash();
});
</script>

<template>
    <form class="space-y-6" @submit.prevent="handleLogin">
        <div
          v-if="loginNotice"
          class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
        >
          {{ loginNotice }}
        </div>
        <div>
          <label for="email" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('auth.emailLabel') }}</label>
          <div class="mt-2">
            <input type="email" id="email" v-model="email" autocomplete="email" required :placeholder="t('auth.emailPlaceholder')" 
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"/>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <label for="password" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('auth.passwordLabel') }}</label>
            <div class="text-sm">
              <a href="#" class="font-semibold text-indigo-400 hover:text-indigo-300">{{ t('auth.forgotPassword') }}</a>
            </div>
          </div>
          <div class="mt-2">
            <input type="password" id="password" v-model="password" autocomplete="current-password" required :placeholder="t('auth.passwordPlaceholder')" 
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"/>
          </div>
        </div>

        <div>
          <button type="submit" :disabled="authStore.loading" class="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-2.5 text-md/0 font-semibold text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
            {{ authStore.loading ? t('auth.signingIn') : t('auth.signIn') }}
          </button>
          <p v-if="authStore.error" class="error">{{ authStore.error }}</p>
        </div>
      </form>

</template>

