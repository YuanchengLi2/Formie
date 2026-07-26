# Reanalysis Declaration Confirmation

## Behavior

Selecting **Analyze Again** from any completed result opens the existing set-declaration screen before reanalysis starts. The form is prefilled from the stored authoritative declaration. For historical sessions without a declaration, it is prefilled from the saved exercise label and repetition count when available, with unknown load selected.

Submitting the form validates the declaration, updates it on the existing analysis session, and reuses the already uploaded original and upright analysis videos. Reanalysis never starts directly from the result screen.

The secondary action is **Cancel**, which returns to the unchanged completed result. It does not discard a recording or alter the saved declaration.

## Error Handling

Validation remains inline on the declaration screen. A failed reset or network request leaves the form and entered values available for retry. No video is uploaded again.

## Testing

- Current declaration is prefilled for every reanalysis.
- Historical exercise and repetition data are prefilled when available.
- Submitting sends the edited declaration with the existing session ID.
- Cancel returns to the existing result without a reset request.
- Failed submission retains the form and entered values.
