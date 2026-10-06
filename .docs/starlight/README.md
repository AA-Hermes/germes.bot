# Starlight documentation app

This directory is reserved for the Astro Starlight application that publishes the repository documentation.

Source documentation:

```text
/.docs/*.md
```

Starlight application:

```text
/.docs/starlight/
```

Generated public output:

```text
/docs/
```

Public URL prefix:

```text
/docs/
```

The Starlight application must treat the Markdown files in the parent `.docs` directory as the documentation source. Generated files under the repository root `docs` directory must not be edited manually.
