def save_rhi_history(road_id, rhi, defect_count, cursor):
    cursor.execute(
        """
        INSERT INTO road_history (
            road_id,
            rhi,
            defect_count,
            timestamp
        )
        VALUES (%s, %s, %s, NOW());
        """,
        (road_id, rhi, defect_count),
    )