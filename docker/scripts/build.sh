#!/usr/bin/env bash

# The MizarWidget git tag to checkout
git_tag=$MIZARWIDGET_VERSION

# Exit on any non-zero status
trap 'exit' ERR
set -E

# The APT dependencies
build_dependencies="git
	python-pip 
	curl"

# Install the build dependencies
apt-get update -y
apt-get install -y --no-install-recommends apt-utils
apt-get install -y --fix-missing $build_dependencies

# Install the runtime dependencies
apt-get install -y --fix-missing \
	nodejs \
	ca-certificates \
	nginx

curl https://www.npmjs.com/install.sh | sh
pip install lxml	

# Configure npm by allowing root to use npm
echo "unsafe-perm=true" > ~/.npmrc

# Create the mizarwidget build environment
git clone https://github.com/MizarWeb/MizarWidget.git
cd MizarWidget
git checkout ${BUILD_VERSION}
git submodule init
git submodule update

# install grunt
npm install -g grunt-cli grunt

# Build
cd external/Mizar
npm install
npm run build:prod
npm run doc:create
npm run license

cd ../..
npm install
npm run build:dist

# Install MizarWidget on the web server.
rm /var/www/html/index.nginx-debian.html
cp ../README.md /var/www/html/
chmod 644 /var/www/html/README.md
cp -r dist/* /var/www/html
cp -r external/Mizar/api_doc /var/www/html/

# Export configuration file
mkdir -p /opt/mizar/conf
mv /var/www/html/conf/* /opt/mizar/conf/
rm -rf /var/www/html/conf
ln -s /opt/mizar/conf /var/www/html/

# Set up the Nginx Mapserver configuration.
rm -rf /etc/nginx/conf.d/*
cp ../nginx.conf /etc/nginx/nginx.conf
cp ../mizar.nginx.conf /etc/nginx/conf.d/default.conf

# Remove the build dependencies.
apt-get remove -y $build_dependencies

# Clean up APT when done.
apt-get autoremove -y
apt-get clean -y
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*



