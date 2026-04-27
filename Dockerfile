FROM python:3.11-slim

# Create odoo user early (fixed UID for volume consistency)
RUN useradd -m -u 1000 -s /bin/bash odoo

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    git \
    build-essential \
    libpq-dev \
    node-less \
    wget \
    fontconfig \
    libfreetype6 \
    libjpeg62-turbo \
    libpng16-16 \
    libxrender1 \
    xfonts-75dpi \
    xfonts-base \
    libldap2-dev \
    libsasl2-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install wkhtmltopdf
RUN wget https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && apt-get update \
    && apt-get install -y ./wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && rm wkhtmltox_0.12.6.1-3.bookworm_amd64.deb

WORKDIR /app

# Copy code
COPY . /app

# Install Python deps
RUN pip install --no-cache-dir -r requirements.txt

# Prepare data directory
RUN mkdir -p /var/lib/odoo \
    && chown -R odoo:odoo /var/lib/odoo /app

USER odoo

CMD ["python3", "odoo-bin", "-c", "/etc/odoo/odoo.conf"]