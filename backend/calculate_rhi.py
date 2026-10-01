def calculate_rhi(road_id, cursor):
    cursor.execute(
        """
        SELECT COUNT(*), COALESCE(SUM(severity), 0)
        FROM defects
        WHERE road_id = %s;
        """,
        (road_id,),
    )
    defect_count, severity_sum = cursor.fetchone()
    severity_sum = float(severity_sum or 0)

    if defect_count == 0:
        rhi = 100.0
    else:
        damage_score = (
            (defect_count / (defect_count + 5)) * 40
            + (severity_sum / (severity_sum + 200)) * 60
        )
        rhi = max(0.0, min(100.0, 100.0 - damage_score))

    cursor.execute(
        "UPDATE roads SET rhi = %s WHERE id = %s;",
        (rhi, road_id),
    )

    return rhi