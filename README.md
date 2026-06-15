# GitLab Sprint Manager

Une application **Rails + Vue 3 (Vite) + Tailwind** pour piloter vos sprints
(milestones) GitLab avec une bien meilleure UX.

> ⚠️ **Lecture seule sur GitLab.** L'application ne fait que *consommer* l'API
> GitLab en lecture (milestones, tickets). Elle ne crée et ne modifie **jamais**
> rien sur GitLab. Tout l'état local (calendrier, marqueurs) vit dans la base
> PostgreSQL de l'app.

## Fonctionnalités

- **Connexion configurable** : URL d'instance GitLab + Personal Access Token
  (scope `read_api` suffisant), stockés localement, testables en un clic.
- **Tableau de sprint** : sélection projet + milestone, vue d'ensemble et
  **répartition des marqueurs** sur les tickets.
- **Marqueurs locaux** (un seul par ticket) : `Pas commencé`, `En cours`,
  `Développement terminé`, `Retours à traiter`, `Review terminée`, `Mergé`.
  Modifiables par menu ou par glisser-déposer entre colonnes.
- **Calendrier de sprint** (du `start_date` au `due_date` du milestone) :
  - glissez les tickets sur un créneau **horaire** ou sur la bande **journée** ;
  - créez des blocs **« autre projet »** pour marquer le temps passé ailleurs ;
  - déplacez / éditez / supprimez les créneaux. Tout reste **en local**.

## Lancer l'application (port 3005)

Le projet est prévu pour tourner dans le **devcontainer** (Ruby 4.0.5, PostgreSQL,
Redis) défini dans `.devcontainer/`.

1. Ouvrir le dépôt dans VS Code → *Reopen in Container* (ou `docker compose -f
   .devcontainer/compose.yml up`). Le devcontainer installe les gems et les
   dépendances npm automatiquement.
2. Préparer la base puis démarrer le serveur **et** Vite :

   ```sh
   bin/rails db:prepare      # crée la base + applique les migrations
   bin/dev                   # lance Rails (port 3005) + Vite ensemble
   ```

3. Ouvrir http://localhost:3005, aller dans **Réglages**, renseigner l'URL
   GitLab et le token, puis choisir un projet et un milestone.

> `bin/dev` s'appuie sur `Procfile.dev` (process `web` sur le port 3005 +
> process `vite`). Les ports 3005 et 3036 sont forwardés par le devcontainer.

### ⚠️ `rails s` et le binding dans le conteneur

Rails 7.1 lie `rails s` à **`localhost`** en développement. Dans le conteneur,
le port publié ne l'atteint alors pas → page vide
(`NS_ERROR_NET_EMPTY_RESPONSE`). Deux solutions :

- **Recommandé** : `bin/dev` (lie Rails à `0.0.0.0:3005` et lance Vite).
- Sinon `bin/rails s -b 0.0.0.0 -p 3005`.

La variable `BINDING=0.0.0.0` est définie dans `.devcontainer/compose.yml`, donc
après reconstruction du devcontainer un simple `rails s` se lie aussi à
`0.0.0.0`. Pense à lancer Vite à côté (`bin/vite dev`) — ou utilise `bin/dev`
qui fait les deux.

## Stack technique

| Couche      | Détail                                                        |
|-------------|---------------------------------------------------------------|
| Backend     | Rails 7.1, PostgreSQL, `faraday` pour l'API GitLab            |
| Frontend    | Vue 3 + Pinia + Vite (`vite_rails`), Tailwind CSS, dayjs      |
| Modèles     | `GitlabConfig`, `CalendarEvent`, `TicketStatus`               |
| API interne | `/api/settings`, `/api/gitlab/*` (proxy RO), `/api/calendar_events`, `/api/ticket_statuses` |

Le code frontend vit sous `app/frontend/` (entrypoint `entrypoints/application.js`).

### Endpoints GitLab consommés (tous en GET)

- `GET /user` — validation du token
- `GET /projects` — projets de l'utilisateur
- `GET /projects/:id/milestones` — milestones (sprints)
- `GET /projects/:id/milestones/:milestone_id/issues` — tickets du sprint
