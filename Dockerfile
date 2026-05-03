# ──────────────────────────────────────────────
#  Stage: base  (system deps + python packages)
# ──────────────────────────────────────────────
FROM python:3.11-slim AS base

# All system packages + wkhtmltopdf in ONE layer → smaller image, no duplicate apt index
RUN apt-get update && apt-get install -y --no-install-recommends \
        postgresql-client \
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
    && wget -q https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && apt-get install -y ./wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && rm wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && rm -rf /var/lib/apt/lists/*

# Fixed UID so named volume ownership stays consistent across rebuilds
RUN useradd -m -u 1000 -s /bin/bash odoo

WORKDIR /app

# Copy ONLY requirements first → pip layer is cached unless deps actually change
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Data dir must exist before USER switch
RUN mkdir -p /var/lib/odoo && chown odoo:odoo /var/lib/odoo

# ──────────────────────────────────────────────
#  Stage: app  (production — source baked in)
# ──────────────────────────────────────────────
FROM base AS app

# Copy source after deps so a code-only change doesn't invalidate the pip layer
COPY --chown=odoo:odoo . /app

COPY --chown=odoo:odoo scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER odoo
EXPOSE 8069 8072

ENTRYPOINT ["/entrypoint.sh"]
CMD ["python3", "odoo-bin", "--config=/etc/odoo/odoo.conf"]
