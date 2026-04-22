Build all images, push to registry, and run `docker compose pull && docker compose up -d`
on the production host via SSH. Stop and ask the user before executing any step
that touches the live `wheretogoforgreatweather.com` domain.
