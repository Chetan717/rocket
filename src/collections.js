const COLLECTIONS = {
  USERS:          import.meta.env.VITE_COL_USERS,
  ADMINUSER:      import.meta.env.VITE_COL_ADMINUSER,
  COUPONCODE:     import.meta.env.VITE_COL_COUPONCODE,
  MTEAM:          import.meta.env.VITE_COL_MTEAM,
  SUBSCRIPTION:   import.meta.env.VITE_COL_SUBSCRIPTION,
  MLMCOMP:        import.meta.env.VITE_COL_MLMCOMP,
  MLMPROFILES:    import.meta.env.VITE_COL_MLMPROFILES,
  MLMTEMPLATE:    import.meta.env.VITE_COL_MLMTEMPLATE,
  LEADMANAGEMENT: import.meta.env.VITE_COL_LEADMANAGEMENT,
  MLMGRAPHICS:    import.meta.env.VITE_COL_MLMGRAPHICS,
  REMOVEBG:       import.meta.env.VITE_COL_REMOVEBG,
  PAYMENTLOG:     import.meta.env.VITE_COL_PAYMENTLOG,
  MUSIC:          import.meta.env.VITE_COL_MUSIC ?? "music",
  TEMPLATEQUALITY: import.meta.env.VITE_COL_TEMPLATEQUALITY ?? "templatequality",
};

export { COLLECTIONS };
