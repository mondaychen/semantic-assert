Feature: Saving changes in the editor

  The steps below are the requirement, word for word. Every "Then the alert ..."
  line becomes a semantic claim, so rewording the alert does not touch this file.

  Scenario: A failed save tells the user what happened and what to do
    Given the editor failed to save the user's changes
    Then the alert tells the user their changes were not saved
    And the alert tells the user how to recover

  Scenario: A reworded alert still meets the requirement
    Given the editor shows the alert "Your changes haven't been saved. Please give it another try."
    Then the alert tells the user their changes were not saved
    And the alert tells the user how to recover

  @fail
  Scenario: A vague alert does not meet the requirement
    Given the editor shows the alert "Something went wrong."
    Then the alert tells the user how to recover
