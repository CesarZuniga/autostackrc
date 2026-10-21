---
title: Ruby
category: Language
scope: glob
globs: ["**/*.rb"]
---

- Add `# frozen_string_literal: true` and follow the community style guide; lint with RuboCop.
- Prefer small objects and methods with a single responsibility; favor composition over deep inheritance.
- Use keyword arguments for clarity on methods with more than two parameters.
- Raise specific exception classes; never `rescue Exception` or rescue without handling.
- Manage dependencies with Bundler and commit `Gemfile.lock` for applications.
- Test with RSpec or Minitest; keep tests fast and isolated from the network.
