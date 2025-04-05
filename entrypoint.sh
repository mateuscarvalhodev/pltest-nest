#!/bin/sh

while ! nc -z db 5432; do
  sleep 1
done

npx prisma migrate deploy

exec node dist/main
