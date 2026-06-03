import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import CatalogView from '@/views/CatalogView.vue';
import RunsView from '@/views/RunsView.vue';
import RunDetailView from '@/views/RunDetailView.vue';
import SchedulesView from '@/views/SchedulesView.vue';
import CompareView from '@/views/CompareView.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/catalog', name: 'catalog', component: CatalogView },
    { path: '/runs', name: 'runs', component: RunsView },
    { path: '/runs/:runId', name: 'run-detail', component: RunDetailView },
    { path: '/schedules', name: 'schedules', component: SchedulesView },
    { path: '/compare', name: 'compare', component: CompareView },
  ],
});
