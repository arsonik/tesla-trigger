rsync -avh -e ssh --compress --recursive --delete  --checksum --exclude-from=exclude-rsync . root@loop.arsonik.com:/var/www/tesla.arsonik.com/
ssh root@arsonik.com "cd /var/www/tesla.arsonik.com/ && yarn install && pm2 restart Tesla"
