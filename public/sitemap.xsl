<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">

  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <title>Sitemap — HC Propeleri</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0a0f1a;
            color: #e2e8f0;
            padding: 2rem;
          }
          h1 {
            font-size: 1.5rem;
            margin-bottom: 0.25rem;
            color: #f8fafc;
          }
          .subtitle {
            color: #94a3b8;
            font-size: 0.875rem;
            margin-bottom: 1.5rem;
          }
          .count {
            color: #e8732a;
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.8125rem;
          }
          th {
            text-align: left;
            padding: 0.625rem 0.75rem;
            background: #1a2744;
            color: #94a3b8;
            font-weight: 600;
            font-size: 0.6875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            position: sticky;
            top: 0;
            z-index: 1;
          }
          td {
            padding: 0.5rem 0.75rem;
            border-bottom: 1px solid #1e293b;
          }
          tr:hover td { background: #111827; }
          a {
            color: #60a5fa;
            text-decoration: none;
          }
          a:hover {
            color: #93bbfc;
            text-decoration: underline;
          }
          .langs { display: flex; gap: 0.375rem; }
          .lang-badge {
            display: inline-block;
            padding: 0.125rem 0.375rem;
            border-radius: 0.25rem;
            background: #1e293b;
            color: #94a3b8;
            font-size: 0.6875rem;
            text-transform: uppercase;
          }
          .priority {
            display: inline-block;
            min-width: 2rem;
            text-align: center;
            padding: 0.125rem 0.375rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: 600;
          }
          .p-high { background: #166534; color: #4ade80; }
          .p-mid  { background: #854d0e; color: #facc15; }
          .p-low  { background: #1e293b; color: #94a3b8; }
        </style>
      </head>
      <body>
        <h1>Sitemap</h1>
        <p class="subtitle">
          HC Propeleri — <span class="count"><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></span> URLs
        </p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>URL</th>
              <th>Languages</th>
              <th>Priority</th>
              <th>Last Modified</th>
            </tr>
          </thead>
          <tbody>
            <xsl:for-each select="sitemap:urlset/sitemap:url">
              <tr>
                <td style="color:#475569"><xsl:value-of select="position()"/></td>
                <td>
                  <a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a>
                </td>
                <td>
                  <div class="langs">
                    <xsl:for-each select="xhtml:link[@rel='alternate']">
                      <a class="lang-badge" href="{@href}">
                        <xsl:value-of select="@hreflang"/>
                      </a>
                    </xsl:for-each>
                  </div>
                </td>
                <td>
                  <xsl:variable name="prio" select="sitemap:priority"/>
                  <span>
                    <xsl:attribute name="class">
                      priority
                      <xsl:choose>
                        <xsl:when test="$prio &gt;= 0.8"> p-high</xsl:when>
                        <xsl:when test="$prio &gt;= 0.5"> p-mid</xsl:when>
                        <xsl:otherwise> p-low</xsl:otherwise>
                      </xsl:choose>
                    </xsl:attribute>
                    <xsl:value-of select="sitemap:priority"/>
                  </span>
                </td>
                <td style="color:#64748b">
                  <xsl:value-of select="substring(sitemap:lastmod, 1, 10)"/>
                </td>
              </tr>
            </xsl:for-each>
          </tbody>
        </table>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
