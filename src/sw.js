import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

// Não interceptar requisições para *.supabase.co: deixar o navegador tratá-las diretamente.
// Assim evitamos "Failed to fetch" e locks do SW que quebram transações do mês.
