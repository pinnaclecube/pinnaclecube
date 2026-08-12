router.post("/admin/profiles", requireStaffAuth, async (req: Request, res: Response): Promise<void> => {
  // Validate request body
  const { email, name, visaTarget, accessLevel, profession } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required and must be a string" });
    return;
  }

  // Attempt to insert the new profile
  try {
    const [newProfile] = await db.insert(profilesTable).values({ email, name, visaTarget, accessLevel, profession }).returning({ id: profilesTable.id });
    res.status(201).json({ id: newProfile.id });
  } catch (error) {
    // Check if error is due to unique constraint on email
    if (error.code === '23505') { // PostgreSQL constraint violation code
      res.status(409).json({ error: "Email already exists" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});