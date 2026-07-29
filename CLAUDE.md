# Agent Instructions

## Overview

You operate within a 3-tier system: Directive (What to do), Plan (How to do it), and Execution (Doing it).
- **Directive**: High-level goals and architectural decisions.
- **Plan**: Break down tasks into steps, estimate time, identify risks, and ask clarifying questions.
- **Execution**: Write and test code.

## Communication

- **Status**: At the end of every response, provide a brief status update (e.g., "On track", "Blocked", "Refining plan").
- **Questions**: If you need clarification, ask questions in the "Questions" section of your response.
- **Time Estimates**: Provide time estimates for tasks in the "Plan" section. Be realistic but efficient.

## Security Principles (CRITICAL)

You are building a public-facing service that handles file uploads and long-running jobs.
Security is the **top priority**.

### File Upload Security
- **Never Trust User Input**: All file uploads must be treated as potentially malicious.
- **File Type Validation**: Validate file types on the server. Do not rely on the `Content-Type` header alone. Use magic numbers for images/audio if possible.
- **File Size Limits**: Enforce strict file size limits to prevent DoS attacks.
- **Virus Scanning**: Use a virus scanner like ClamAV for all uploads.
- **Storage**: Store uploaded files outside the webroot (e.g., `/var/lib/app/uploads`).
- **Temporary Files**: Use `mkstemp` or secure temporary file APIs to avoid race conditions.

### Path Traversal Defense (CRITICAL)
- **Never Trust User-Provided Filenames**: User input must never be used directly in file paths.
- **Normalize Paths**: Use `path.normalize()` to resolve `..` components.
- **Path Prefix Validation**: Always verify that the final path starts with the expected directory prefix.
- **Sanitize Filenames**: Remove or replace potentially dangerous characters (e.g., `/`, `\`, null bytes).

### Long-Running Job Security
- **Timeouts**: Implement strict timeouts for all external API calls (OpenAI, Google, Deepgram).
- **Rate Limiting**: Implement rate limiting on API keys and job creation.
- **Input Validation**: Validate all job parameters (e.g., language codes, model names) against an allowlist.
- **Error Handling**: Fail gracefully on API errors. Do not expose sensitive error messages to users.

### Authentication & Authorization
- **Secret Management**: Never hardcode secrets. Use environment variables.
- **API Keys**: Use secure, non-guessable API keys. Implement rotation policies.
- **Admin Controls**: Implement admin-only endpoints for managing jobs and clearing data.

## Development Practices

- **Testing**: For every feature, write unit tests and, if applicable, integration tests.
- **Documentation**: Document your code and architectural decisions in `docs/`.
- **Progressive Enhancement**: Start with a working MVP and add features progressively.
- **Error Handling**: Implement robust error handling and logging.

## Specific Implementation Details

### Audio Processing
- **Sampling Rate**: Use 48kHz for high-quality audio processing.
- **Chunking**: Process audio in chunks (e.g., 200ms) for better memory management.
- **Buffering**: Use fixed-size buffers for audio processing to avoid memory leaks.

### UI/UX
- **Progress Indicators**: Provide real-time feedback for long-running operations.
- **Error Messages**: Display user-friendly error messages.
- **Mobile-First**: Design for mobile devices first, then scale to desktop.

## Self-Correction

If you encounter security vulnerabilities or major architectural issues in your plan, **stop** and:
1. Identify the issue
2. Propose a secure alternative
3. Explain the risks of the current approach
4. Ask for clarification if needed

**Never** proceed with a known security vulnerability.
